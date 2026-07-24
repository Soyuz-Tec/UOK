param(
    [string]$ProjectName = "uok",
    [string]$Image = "",
    [string]$DatabaseImage = "",
    [ValidateRange(0, 65535)]
    [int]$CandidatePort = 0,
    [ValidateRange(1, 2)]
    [int]$Runs = 2,
    [string]$VerifierPassword = "admin",
    [switch]$FailAfterVerification,
    [string]$ComposeFile = "deploy\compose-candidate-isolated.yaml"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

. (Join-Path $PSScriptRoot "uok_common_ops.ps1")

function Get-UokCandidateFreePort {
    $listener = [System.Net.Sockets.TcpListener]::new(
        [System.Net.IPAddress]::Loopback,
        0
    )
    try {
        $listener.Start()
        return ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
    } finally {
        $listener.Stop()
    }
}

function Get-UokCandidateImage {
    param(
        [Parameter(Mandatory = $true)][string]$RuntimeProject,
        [Parameter(Mandatory = $true)][string]$ServiceName,
        [AllowEmptyString()][string]$RequestedImage
    )

    $reference = $RequestedImage
    if (-not $reference) {
        $containerName = "$RuntimeProject-$ServiceName-1"
        $containerOutput = @(
            & podman container inspect `
                --format "{{.Image}}" `
                $containerName
        )
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to inspect the exact image for $containerName."
        }
        $reference = "$($containerOutput | Select-Object -Last 1)".Trim()
        if (-not $reference) {
            throw "Podman returned an empty image identity for $containerName."
        }
    }
    $imageOutput = @(
        & podman image inspect `
            --format "{{.Id}}" `
            $reference
    )
    if ($LASTEXITCODE -ne 0) {
        throw "Unable to resolve immutable local image identity for $reference."
    }
    $resolved = "$($imageOutput | Select-Object -Last 1)".Trim()
    if (-not $resolved) {
        throw "Podman returned an empty immutable image identity for $reference."
    }
    return $resolved
}

function Wait-UokCandidateHealth {
    param([Parameter(Mandatory = $true)][string]$CandidateBaseUrl)

    $lastError = $null
    for ($attempt = 1; $attempt -le 40; $attempt++) {
        try {
            $health = Invoke-RestMethod `
                -Method "GET" `
                -Uri "$CandidateBaseUrl/health" `
                -TimeoutSec 5
            if (
                $health.status -eq "ok" `
                -and $health.version -eq "3.1.0-alpha.3" `
                -and $health.candidate_state -eq "ephemeral"
            ) {
                return
            }
            $lastError = "unexpected health payload"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Seconds 2
    }
    throw "Isolated candidate health did not become ready. Last error: $lastError"
}

function Get-UokCandidateResources {
    param([Parameter(Mandatory = $true)][string]$RunId)

    $checks = @(
        @{ kind = "container"; arguments = @("ps", "-a", "--filter", "label=uok.candidate.run=$RunId", "--format", "{{.ID}}") },
        @{ kind = "volume"; arguments = @("volume", "ls", "--filter", "label=uok.candidate.run=$RunId", "--format", "{{.Name}}") },
        @{ kind = "network"; arguments = @("network", "ls", "--filter", "label=uok.candidate.run=$RunId", "--format", "{{.Name}}") }
    )
    foreach ($check in $checks) {
        $output = @(& podman @($check.arguments))
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to inventory candidate $($check.kind) resources."
        }
        foreach ($item in $output) {
            if ("$item".Trim()) {
                [pscustomobject]@{
                    kind = $check.kind
                    id = "$item".Trim()
                }
            }
        }
    }
}

function Assert-UokCandidateResourcesRemoved {
    param([Parameter(Mandatory = $true)][string]$RunId)

    $residual = @(Get-UokCandidateResources -RunId $RunId)
    if ($residual.Count) {
        $labels = @($residual | ForEach-Object { "$($_.kind):$($_.id)" })
        throw "Disposable candidate resources remain: $($labels -join ', ')"
    }
}

function Remove-UokCandidateResidualResources {
    param([Parameter(Mandatory = $true)][string]$RunId)

    $resources = @(Get-UokCandidateResources -RunId $RunId)
    foreach ($resource in @($resources | Where-Object kind -eq "container")) {
        & podman rm --force $resource.id | Out-Null
    }
    foreach ($resource in @($resources | Where-Object kind -eq "volume")) {
        & podman volume rm --force $resource.id | Out-Null
    }
    foreach ($resource in @($resources | Where-Object kind -eq "network")) {
        & podman network rm --force $resource.id | Out-Null
    }
}

function Invoke-UokCandidateIsolatedRun {
    param(
        [Parameter(Mandatory = $true)][string]$RunId,
        [Parameter(Mandatory = $true)][string]$CandidateProject,
        [Parameter(Mandatory = $true)][string]$CandidateBaseUrl,
        [Parameter(Mandatory = $true)][string]$ResolvedCompose,
        [Parameter(Mandatory = $true)][string]$Password,
        [Parameter(Mandatory = $true)][bool]$InjectFailure
    )

    $primaryError = $null
    try {
        Invoke-Native "podman" @(
            "compose",
            "-p", $CandidateProject,
            "-f", $ResolvedCompose,
            "up", "-d"
        )
        Wait-UokCandidateHealth -CandidateBaseUrl $CandidateBaseUrl
        & (Join-Path $PSScriptRoot "verify_uok_candidate.ps1") `
            -BaseUrl $CandidateBaseUrl `
            -Password $Password `
            -EphemeralTarget
        if ($InjectFailure) {
            throw "Controlled post-verification failure for teardown qualification."
        }
    } catch {
        $primaryError = $_
    }

    $cleanupErrors = @()
    $beforeCleanup = @()
    try {
        $beforeCleanup = @(Get-UokCandidateResources -RunId $RunId)
        Write-Host "Candidate resource inventory before teardown: $($beforeCleanup.Count)"
        if (
            -not $primaryError `
            -and (
                @($beforeCleanup | Where-Object kind -eq "container").Count -ne 2 `
                -or @($beforeCleanup | Where-Object kind -eq "volume").Count -ne 2 `
                -or @($beforeCleanup | Where-Object kind -eq "network").Count -ne 1
            )
        ) {
            throw "Candidate stack inventory did not contain exactly two containers, two volumes, and one network."
        }
    } catch {
        $cleanupErrors += $_.Exception.Message
    }
    try {
        Invoke-Native "podman" @(
            "compose",
            "-p", $CandidateProject,
            "-f", $ResolvedCompose,
            "down", "-v", "--remove-orphans"
        )
    } catch {
        $cleanupErrors += $_.Exception.Message
    }
    try {
        Assert-UokCandidateResourcesRemoved -RunId $RunId
    } catch {
        $cleanupErrors += $_.Exception.Message
        try {
            Remove-UokCandidateResidualResources -RunId $RunId
            Assert-UokCandidateResourcesRemoved -RunId $RunId
        } catch {
            $cleanupErrors += $_.Exception.Message
        }
    }

    if ($primaryError) {
        if ($cleanupErrors.Count) {
            throw "Candidate verification failed: $($primaryError.Exception.Message) Cleanup also failed: $($cleanupErrors -join '; ')"
        }
        throw $primaryError
    }
    if ($cleanupErrors.Count) {
        throw "Candidate cleanup failed: $($cleanupErrors -join '; ')"
    }
}

$resolvedCompose = (Resolve-Path -LiteralPath $ComposeFile).Path
$resolvedImage = Get-UokCandidateImage `
    -RuntimeProject $ProjectName `
    -ServiceName "api" `
    -RequestedImage $Image
$resolvedDatabaseImage = Get-UokCandidateImage `
    -RuntimeProject $ProjectName `
    -ServiceName "db" `
    -RequestedImage $DatabaseImage

$previousImage = $env:UOK_CANDIDATE_API_IMAGE
$previousDatabaseImage = $env:UOK_CANDIDATE_DB_IMAGE
$previousPort = $env:UOK_CANDIDATE_HOST_PORT
$previousRunId = $env:UOK_CANDIDATE_RUN_ID
$env:UOK_CANDIDATE_API_IMAGE = $resolvedImage
$env:UOK_CANDIDATE_DB_IMAGE = $resolvedDatabaseImage
try {
    for ($run = 1; $run -le $Runs; $run++) {
        $runPort = $CandidatePort
        if ($runPort -eq 0) {
            $runPort = Get-UokCandidateFreePort
        }
        $env:UOK_CANDIDATE_HOST_PORT = "$runPort"
        $candidateBaseUrl = "http://127.0.0.1:$runPort"
        $runId = [Guid]::NewGuid().ToString("N")
        $env:UOK_CANDIDATE_RUN_ID = $runId
        $candidateProject = "uok-candidate-$runId"
        Invoke-UokCandidateIsolatedRun `
            -RunId $runId `
            -CandidateProject $candidateProject `
            -CandidateBaseUrl $candidateBaseUrl `
            -ResolvedCompose $resolvedCompose `
            -Password $VerifierPassword `
            -InjectFailure ($FailAfterVerification -and $run -eq 1)
        Write-Host "Isolated candidate verification pass $run of $Runs removed all disposable resources."
    }
} finally {
    $env:UOK_CANDIDATE_API_IMAGE = $previousImage
    $env:UOK_CANDIDATE_DB_IMAGE = $previousDatabaseImage
    $env:UOK_CANDIDATE_HOST_PORT = $previousPort
    $env:UOK_CANDIDATE_RUN_ID = $previousRunId
}

Write-Host "Candidate neutrality passed $Runs time(s) against immutable runtime images."
