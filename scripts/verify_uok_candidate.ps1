param(
    [string]$BaseUrl = "http://127.0.0.1:18088",
    [string]$Username = "admin",
    [string]$Password = "admin"
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "verify\UokCandidateHttp.ps1")
. (Join-Path $PSScriptRoot "verify\UokCandidateContacts.ps1")
. (Join-Path $PSScriptRoot "verify\UokCandidateEvidence.ps1")

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

$contacts = Invoke-UokContactsCandidateScenario -Headers $headers -OpsHeaders $opsHeaders -ViewerHeaders $viewerHeaders -Stamp $stamp
Assert-UokCandidateEvidence -Headers $headers -OpsHeaders $opsHeaders -ContactId $contacts.contact_id -Stamp $stamp

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
    uok_verifier = "passed"
} | ConvertTo-Json -Depth 20
