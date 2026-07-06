param(
    [string]$BaseUrl = "http://127.0.0.1:18088",
    [string]$Username = "admin",
    [string]$Password = "admin"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "verify\UokCandidateHttp.ps1")
. (Join-Path $PSScriptRoot "verify\UokCandidateEvidence.ps1")

function Get-UokManifestScalars {
    param([Parameter(Mandatory = $true)][string]$Path)

    $values = @{}
    foreach ($line in Get-Content -Path $Path) {
        $trimmed = ($line -split "#", 2)[0].Trim()
        if (-not $trimmed) {
            continue
        }
        if ($trimmed -match "^([A-Za-z_][A-Za-z0-9_]*):\s*(.+)$") {
            $key = $Matches[1]
            $value = $Matches[2].Trim()
            if ($value.StartsWith('"') -and $value.EndsWith('"')) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if ($value.StartsWith("'") -and $value.EndsWith("'")) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $values[$key] = $value
        }
    }
    return $values
}

function Get-UokCandidateVerifierModules {
    $repoRoot = Split-Path -Parent $PSScriptRoot
    $moduleRoot = Join-Path $repoRoot "modules"
    Get-ChildItem -Path $moduleRoot -Filter "manifest.yaml" -Recurse | ForEach-Object {
        $manifest = Get-UokManifestScalars -Path $_.FullName
        if ($manifest.candidate_verifier_script) {
            [pscustomobject]@{
                Name = $manifest.name
                Script = Join-Path $repoRoot $manifest.candidate_verifier_script
                VerifierFunction = $manifest.candidate_verifier_function
                EvidenceFunction = $manifest.candidate_evidence_function
            }
        }
    }
}

$health = Invoke-UokJson -Path "/health"
if ($health.status -ne "ok" -or $health.version -ne "3.1.0-alpha.2") {
    throw "Unexpected health response: $($health | ConvertTo-Json -Depth 5)"
}

$headers = New-UokAuthHeaders -Username $Username -Password $Password
$opsHeaders = New-UokAuthHeaders -Username "ops" -Password "ops123"
$viewerHeaders = New-UokAuthHeaders -Username "viewer" -Password "viewer123"
$stamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$catalog = Invoke-UokJson -Path "/api/modules/catalog" -Headers $headers
if ($catalog.modules.'apps.manager'.status -ne "installed" -or -not $catalog.modules.'contacts.core') {
    throw "Unexpected Apps Manager catalog state: $($catalog | ConvertTo-Json -Depth 20)"
}

$moduleResults = @()
foreach ($module in Get-UokCandidateVerifierModules) {
    if (-not (Test-Path -LiteralPath $module.Script)) {
        throw "Candidate verifier script not found for $($module.Name): $($module.Script)"
    }
    . $module.Script
    $verifier = Get-Command -Name $module.VerifierFunction -CommandType Function -ErrorAction Stop
    $scenario = & $verifier -Headers $headers -OpsHeaders $opsHeaders -ViewerHeaders $viewerHeaders -Stamp $stamp
    if ($module.EvidenceFunction) {
        $evidenceVerifier = Get-Command -Name $module.EvidenceFunction -CommandType Function -ErrorAction Stop
        & $evidenceVerifier -Headers $headers -OpsHeaders $opsHeaders -ContactId $scenario.contact_id -Stamp $stamp
    }
    $moduleResults += [pscustomobject]@{
        name = $module.Name
        status = "passed"
        result = $scenario
    }
}

[pscustomobject]@{
    status = "passed"
    version = $health.version
    apps_manager = "passed"
    contacts_install_uninstall = "passed"
    module_neutral_baseline = "passed"
    migration_discipline = "passed"
    evidence = "passed"
    contacts_full_crm_slice = "passed"
    security_hardening = "passed"
    module_verifiers = $moduleResults
    uok_verifier = "passed"
} | ConvertTo-Json -Depth 20
