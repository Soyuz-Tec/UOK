function Invoke-UokStep {
    param([string]$Name, [scriptblock]$Body)
    Write-Host "==> $Name"
    & $Body
}

function Invoke-Native {
    param([string]$File, [string[]]$Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$File exited with $LASTEXITCODE"
    }
}

function Get-UokRebuildIdentity {
    $treeState = "$(& git status --porcelain=v1 --untracked-files=all)".Trim()
    if ($LASTEXITCODE -ne 0) { throw "Unable to inspect the Git worktree before rebuild." }
    if ($treeState) { throw "Rebuild requires a clean committed worktree." }
    $revision = "$(& git rev-parse --verify HEAD)".Trim()
    if ($LASTEXITCODE -ne 0 -or $revision -cnotmatch "^[0-9a-f]{40}$") {
        throw "Rebuild could not resolve a lowercase 40-hex Git HEAD."
    }
    $version = "$(
        & python -c "import sys; sys.path.insert(0, 'src'); from uok import APP_VERSION; print(APP_VERSION)"
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or -not $version) {
        throw "Rebuild could not resolve the UOK application version."
    }
    return @{ Revision = $revision; Version = $version; SourceUrl = "https://github.com/Soyuz-Tec/UOK" }
}

function Invoke-UokExactComposeRebuild {
    param([string]$RuntimeProject, [string]$ComposePath, $Identity)
    $previous = @($env:UOK_BUILD_VERSION, $env:UOK_BUILD_REVISION, $env:UOK_BUILD_SOURCE_URL)
    try {
        $env:UOK_BUILD_VERSION = $Identity.Version
        $env:UOK_BUILD_REVISION = $Identity.Revision
        $env:UOK_BUILD_SOURCE_URL = $Identity.SourceUrl
        Invoke-UokStep "Rebuild local Podman stack" {
            Invoke-Native "podman" @("compose", "-p", $RuntimeProject, "-f", $ComposePath, "up", "-d", "--build")
        }
    } finally {
        $names = @("UOK_BUILD_VERSION", "UOK_BUILD_REVISION", "UOK_BUILD_SOURCE_URL")
        for ($index = 0; $index -lt $names.Count; $index++) {
            if ($null -eq $previous[$index]) { Remove-Item "Env:\$($names[$index])" -ErrorAction SilentlyContinue }
            else { Set-Item "Env:\$($names[$index])" $previous[$index] }
        }
    }
}

function Assert-UokRebuildRecoveryQuiesced {
    if ($env:OS -ne "Windows_NT") { return }
    $tasks = @(Get-ScheduledTask -TaskName "UOK Podman Auto Start" -ErrorAction SilentlyContinue)
    if ($tasks.Count -eq 0) { return }
    $disabled = Join-Path $env:LOCALAPPDATA "UOK\startup\disabled"
    if (-not (Test-Path -LiteralPath $disabled)) {
        throw "Run AutoStartDisable before Rebuild to prevent recovery races."
    }
    if (@($tasks | Where-Object { $_.State -eq "Running" }).Count -gt 0) {
        throw "Wait for the UOK auto-start task to stop running before Rebuild."
    }
}

function Sync-UokApiRecoveryImageTag {
    param([Parameter(Mandatory = $true)][string]$RuntimeProject)

    $containerName = "$RuntimeProject-api-1"
    $imageId = "$(
        & podman container inspect --format "{{.Image}}" $containerName |
            Select-Object -Last 1
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or -not $imageId) {
        throw "Unable to resolve the exact API image for $containerName."
    }
    $recoveryImage = "docker.io/library/uok-api:latest"
    Invoke-Native "podman" @("tag", $imageId, $recoveryImage)
    $tagId = "$(
        & podman image inspect --format "{{.Id}}" $recoveryImage |
            Select-Object -Last 1
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or $tagId -ne $imageId) {
        throw "The governed recovery API image tag does not match the live container."
    }
}

function Assert-UokApiImageIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$RuntimeProject,
        [Parameter(Mandatory = $true)][string]$ExpectedVersion,
        [Parameter(Mandatory = $true)][string]$ExpectedRevision
    )
    if ($ExpectedRevision -cnotmatch "^[0-9a-f]{40}$") {
        throw "Expected API image revision must be a lowercase 40-hex commit."
    }
    $containerName = "$RuntimeProject-api-1"
    $imageId = "$(
        & podman container inspect --format "{{.Image}}" $containerName |
            Select-Object -Last 1
    )".Trim()
    if ($LASTEXITCODE -ne 0 -or -not $imageId) {
        throw "Unable to resolve the exact API image for $containerName."
    }
    $imageInspectionJson = (& podman image inspect $imageId | Out-String)
    if ($LASTEXITCODE -ne 0 -or -not $imageInspectionJson) {
        throw "Unable to inspect the exact API image."
    }
    $imageInspection = @($imageInspectionJson | ConvertFrom-Json)[0]
    $actualVersion = "$($imageInspection.Labels.'org.opencontainers.image.version')".Trim()
    $actualRevision = "$($imageInspection.Labels.'org.opencontainers.image.revision')".Trim()
    if ($actualVersion -ne $ExpectedVersion -or $actualRevision -ne $ExpectedRevision) {
        throw (
            "API image identity mismatch. Expected version/revision " +
            "$ExpectedVersion/$ExpectedRevision, received $actualVersion/$actualRevision."
        )
    }
    Write-Host "API image identity verified: $actualVersion @ $actualRevision"
}
