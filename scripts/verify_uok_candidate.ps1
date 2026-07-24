param(
    [string]$BaseUrl = "http://127.0.0.1:18088",
    [string]$Username = "admin",
    [string]$Password = "admin",
    [switch]$EphemeralTarget
)

$ErrorActionPreference = "Stop"

$persistentTargetError = "Candidate verification is mutation-heavy and may only run against a disposable target."
if (-not $EphemeralTarget) {
    throw "$persistentTargetError Use scripts\verify_uok_candidate_isolated.ps1."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$catalogCommand = Join-Path $PSScriptRoot "candidate_verifier_catalog.py"
$catalogOutput = & python $catalogCommand
$catalogExitCode = $LASTEXITCODE
if ($catalogExitCode -ne 0) {
    throw "Candidate verifier catalog failed before module scripts were loaded (exit $catalogExitCode)."
}
try {
    $parsedCatalog = ($catalogOutput -join "`n") | ConvertFrom-Json
    # Windows PowerShell 5.1 writes a top-level JSON array as one pipeline
    # object. Re-piping the assigned value normalizes it to individual entries.
    $candidateVerifiers = @($parsedCatalog | ForEach-Object { $_ })
} catch {
    throw "Candidate verifier catalog returned invalid JSON: $($catalogOutput -join "`n")"
}
if ($candidateVerifiers.Count -lt 1) {
    throw "Candidate verifier catalog is empty."
}

. (Join-Path $PSScriptRoot "verify\UokCandidateHttp.ps1")

$health = Invoke-UokJson -Path "/health"
if ($health.status -ne "ok" -or $health.version -ne "3.1.0-alpha.3") {
    throw "Unexpected health response: $($health | ConvertTo-Json -Depth 5)"
}
if ($health.candidate_state -ne "ephemeral") {
    throw "$persistentTargetError The target did not identify itself as ephemeral."
}

$headers = New-UokAuthHeaders -Username $Username -Password $Password
$opsHeaders = New-UokAuthHeaders -Username "ops" -Password "ops123"
$viewerHeaders = New-UokAuthHeaders -Username "viewer" -Password "viewer123"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$moduleResults = @()
foreach ($catalogEntry in $candidateVerifiers) {
    if (
        $catalogEntry.name -isnot [string] `
        -or $catalogEntry.script -isnot [string] `
        -or $catalogEntry.function -isnot [string]
    ) {
        throw "Candidate verifier catalog entry has invalid field types: $($catalogEntry | ConvertTo-Json -Depth 5)"
    }
    $moduleName = [string]$catalogEntry.name
    $relativeScript = [string]$catalogEntry.script
    $functionName = [string]$catalogEntry.function
    $moduleScript = Join-Path -Path $repoRoot -ChildPath $relativeScript
    . $moduleScript
    $verifier = Get-Command -Name $functionName -CommandType Function -ErrorAction Stop
    $scenario = & $verifier -Headers $headers -OpsHeaders $opsHeaders -ViewerHeaders $viewerHeaders -Stamp $stamp
    $moduleResults += [pscustomobject]@{
        name = $moduleName
        status = "passed"
        result = $scenario
    }
}

[pscustomobject]@{
    status = "passed"
    version = $health.version
    verifier_order = @($moduleResults | ForEach-Object { $_.name })
    module_verifiers = $moduleResults
    uok_verifier = "passed"
} | ConvertTo-Json -Depth 20
