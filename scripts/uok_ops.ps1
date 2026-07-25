param(
    [ValidateSet("ToolchainPreflight", "Audit", "TechnologyAudit", "EngineeringEvidence", "UiProof", "Verify", "Rebuild", "Health", "DatabaseCapacity", "PlanningReleaseReadiness", "ContactsVerifierGroupCleanup", "BackupDb", "RestoreDb", "AsuhTest", "AutoStartInstall", "AutoStartStatus", "AutoStartVerify", "AutoStartDisable", "AutoStartEnable", "AutoStartUninstall", "GithubPreflight", "GithubReadiness", "GithubSecuritySetup", "GithubPrChecks")]
    [string]$Action = "Audit",
    [string]$BaseUrl = "http://127.0.0.1:18088",
    [string]$ProjectName = "uok",
    [string]$ComposeFile = "deploy\compose-local-18088.yaml",
    [string]$BackupPath = "",
    [switch]$ConfirmRestore,
    [string]$ContactsCleanupUsername = "ops",
    [string]$ContactsCleanupPlanPath = "",
    [switch]$ExecuteContactsCleanup,
    [switch]$ConfirmContactsCleanup,
    [int]$PullRequestNumber = 0,
    [switch]$WatchChecks,
    [ValidateRange(1, 1440)]
    [int]$CheckIntervalMinutes = 1,
    [string]$IncidentReason = "manual ASUH test",
    [ValidateSet("info", "warning", "critical")]
    [string]$IncidentSeverity = "warning"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot
. (Join-Path $PSScriptRoot "uok_common_ops.ps1")
. (Join-Path $PSScriptRoot "uok_toolchain_versions.ps1")
. (Join-Path $PSScriptRoot "uok_toolchain_preflight.ps1")
function Invoke-PowerShellScript {
    param([string[]]$Arguments)

    Invoke-Native "powershell" $Arguments
}

function Invoke-UokHealth {
    Invoke-UokStep "HTTP health" {
        $lastError = $null
        for ($attempt = 1; $attempt -le 20; $attempt++) {
            try {
                $health = Invoke-WebRequest -UseBasicParsing "$BaseUrl/health" -TimeoutSec 5 |
                    Select-Object -ExpandProperty Content
                Write-Host $health
                return
            } catch {
                $lastError = $_
                Start-Sleep -Seconds 2
            }
        }
        throw "HTTP health did not become ready at $BaseUrl/health. Last error: $lastError"
    }
}

foreach ($helper in @(
    "uok_db_ops.ps1",
    "uok_contacts_cleanup_ops.ps1",
    "uok_planning_release_ops.ps1",
    "uok_ci_quality_ops.ps1",
    "uok_repository_quality_ops.ps1"
)) {
    . (Join-Path $PSScriptRoot $helper)
}

function Invoke-UokAudit {
    Invoke-UokStep "Git whitespace audit" { Invoke-Native "git" @("diff", "--check") }
    Invoke-UokTechnologyAudit
    Invoke-UokStep "Compile Python" { Invoke-Native "python" @("-m", "compileall", "-q", "src", "modules", "tests", "conftest.py") }
    Invoke-UokCiQuality
    Invoke-UokStep "Python dependency audit" { Invoke-Native "python" @("-m", "pip_audit", "-r", "requirements-dev.txt") }
    Push-Location web
    try {
        Invoke-UokStep "Generated API contract drift" { Invoke-Native "npm" @("run", "check:contracts") }
        Invoke-UokStep "Frontend dependency audit" { Invoke-Native "npm" @("audit") }
    } finally {
        Pop-Location
    }
    $env:PYTHONPATH = Join-Path $RepoRoot "src"
    Invoke-UokStep "Container module asset catalog" {
        Invoke-Native "python" @("scripts/validate_container_module_assets.py")
    }
    Invoke-UokStep "Module release contract" {
        Invoke-Native "python" @("-c", "from uok.module_release_contract import validate_module_release_contracts; r=validate_module_release_contracts(); assert r['ok'], r; print(r)")
    }
    Invoke-UokStep "Source-boundary report" {
        Invoke-Native "python" @("-c", "from uok.quality import source_boundary_report; r=source_boundary_report(); assert r['ok'], r; print(r)")
    }
    Invoke-UokStep "Naming policy" { Invoke-Native "python" @("-m", "pytest", "tests/test_naming_policy.py", "-q") }
    Test-UokSourceSize
    Test-UokFolderOrganization
}

function Invoke-UokTechnologyAudit {
    Invoke-UokStep "Technology and code-quality audit" {
        Invoke-Native "python" @("scripts/quality_audit.py")
    }
}

function Invoke-UokEngineeringEvidence {
    Invoke-UokStep "Generate engineering evidence" {
        Invoke-Native "python" @("scripts/engineering_evidence.py")
    }
}

function Invoke-UokUiProof {
    Push-Location web
    try {
        Invoke-UokStep "UI proof automation" { Invoke-Native "npm" @("run", "test:ui-proof") }
    } finally {
        Pop-Location
    }
}

function Invoke-UokVerify {
    Invoke-UokAudit
    Push-Location web
    try {
        Invoke-UokStep "Static frontend build" { Invoke-Native "npm" @("run", "build:static") }
    } finally {
        Pop-Location
    }
    Invoke-UokUiProof
    Invoke-UokStep "Isolated candidate verifier" {
        Invoke-PowerShellScript @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\verify_uok_candidate_isolated.ps1", "-ProjectName", $ProjectName)
    }
}

function Invoke-UokRebuild {
    Assert-UokRebuildRecoveryQuiesced
    $identity = Get-UokRebuildIdentity
    Invoke-UokDatabaseCapacityOffline
    Invoke-UokExactComposeRebuild -RuntimeProject $ProjectName -ComposePath $ComposeFile -Identity $identity
    Invoke-UokHealth
    Invoke-UokDatabaseCapacityLive
    Assert-UokApiImageIdentity `
        -RuntimeProject $ProjectName `
        -ExpectedVersion $identity.Version `
        -ExpectedRevision $identity.Revision
    Sync-UokApiRecoveryImageTag -RuntimeProject $ProjectName
    if ($env:OS -eq "Windows_NT") {
        Invoke-PowerShellScript @(
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            ".\scripts\uok_autostart_ops.ps1",
            "-Action",
            "Refresh"
        )
    }
}

function Invoke-UokDatabaseCapacityOffline {
    Invoke-UokStep "Offline database connection-capacity policy" {
        Invoke-Native "python" @(
            "scripts/verify_database_capacity.py",
            "--environment-file",
            "deploy/database-capacity.env"
        )
    }
}
function Invoke-UokDatabaseCapacityLive {
    Invoke-UokStep "Live database connection-capacity policy" {
        $apiContainer = "$ProjectName-api-1"
        Invoke-Native "podman" @(
            "exec",
            $apiContainer,
            "python",
            "scripts/verify_database_capacity.py",
            "--live"
        )
    }
}
function Invoke-UokDatabaseCapacity {
    Invoke-UokDatabaseCapacityOffline
    Invoke-UokDatabaseCapacityLive
}

function Invoke-UokAsuhTest {
    $incidentDir = Join-Path $RepoRoot "var\incidents"
    New-Item -ItemType Directory -Force -Path $incidentDir | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $eventPath = Join-Path $incidentDir "asuh_$stamp.json"
    $event = [ordered]@{
        type = "ASUH"
        severity = $IncidentSeverity
        reason = $IncidentReason
        created_at = (Get-Date).ToUniversalTime().ToString("o")
        base_url = $BaseUrl
    }
    $event | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 -Path $eventPath
    Write-Host "ASUH incident event written to $eventPath"
    Invoke-UokHealth
    Invoke-UokStep "ASUH isolated candidate verifier" {
        Invoke-PowerShellScript @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\verify_uok_candidate_isolated.ps1", "-ProjectName", $ProjectName)
    }
}

function Invoke-UokGithubPreflight {
    Invoke-UokStep "Git branch and remote" {
        Invoke-Native "git" @("status", "--branch", "--short")
        Invoke-Native "git" @("remote", "-v")
        Invoke-Native "git" @("log", "--oneline", "--decorate", "-1")
    }
    Invoke-UokStep "GitHub upstream sync" {
        Invoke-Native "git" @("fetch", "--prune")
        $upstream = & git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
        if (-not $upstream) {
            throw "Current branch has no upstream branch. Set upstream before publishing."
        }
        $counts = (& git rev-list --left-right --count "$upstream...HEAD").Trim() -split "\s+"
        $behind = [int]$counts[0]
        $ahead = [int]$counts[1]
        Write-Host "Upstream: $upstream"
        Write-Host "Behind: $behind"
        Write-Host "Ahead: $ahead"
        if ($behind -gt 0) {
            throw "Local branch is behind $upstream by $behind commit(s). Reconcile before publishing."
        }
    }
    Invoke-UokStep "Git diff hygiene" { Invoke-Native "git" @("diff", "--check") }
    Invoke-UokStep "Changed files" {
        Invoke-Native "git" @("diff", "--name-status")
        Invoke-Native "git" @("ls-files", "--others", "--exclude-standard")
    }
}
function Invoke-UokGithubOperation {
    param([string]$GithubAction)
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\uok_github_ops.ps1", "-Action", $GithubAction)
    if ($PullRequestNumber -gt 0) {
        $arguments += @("-PullRequestNumber", "$PullRequestNumber")
    }
    if ($WatchChecks) {
        $arguments += "-WatchChecks"
    }
    Invoke-PowerShellScript $arguments
}
function Invoke-UokAutoStartOperation {
    param([string]$AutoStartAction)
    $arguments = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\uok_autostart_ops.ps1", "-Action", $AutoStartAction)
    if ($AutoStartAction -eq "Install") {
        $arguments += @("-CheckIntervalMinutes", "$CheckIntervalMinutes")
    }
    if ($AutoStartAction -eq "Uninstall") {
        $arguments += "-ConfirmUninstall"
    }
    Invoke-PowerShellScript $arguments
}
if (Test-UokActionRequiresTargetToolchain -Action $Action) {
    Assert-UokTargetToolchain -RepoRoot $RepoRoot -Force:($Action -eq "ToolchainPreflight")
}

switch ($Action) {
    "ToolchainPreflight" { Write-Host "UOK target toolchain preflight passed." }
    "Audit" { Invoke-UokAudit }
    "TechnologyAudit" { Invoke-UokTechnologyAudit }
    "EngineeringEvidence" { Invoke-UokEngineeringEvidence }
    "UiProof" { Invoke-UokUiProof }
    "Verify" { Invoke-UokVerify }
    "Rebuild" { Invoke-UokRebuild }
    "Health" { Invoke-UokHealth }
    "DatabaseCapacity" { Invoke-UokDatabaseCapacity }
    "PlanningReleaseReadiness" { Invoke-UokPlanningReleaseReadiness }
    "ContactsVerifierGroupCleanup" { Invoke-UokContactsVerifierGroupCleanup }
    "BackupDb" { Invoke-UokBackupDb }
    "RestoreDb" { Invoke-UokRestoreDb }
    "AsuhTest" { Invoke-UokAsuhTest }
    "AutoStartInstall" { Invoke-UokAutoStartOperation "Install" }
    "AutoStartStatus" { Invoke-UokAutoStartOperation "Status" }
    "AutoStartVerify" { Invoke-UokAutoStartOperation "Verify" }
    "AutoStartDisable" { Invoke-UokAutoStartOperation "Disable" }
    "AutoStartEnable" { Invoke-UokAutoStartOperation "Enable" }
    "AutoStartUninstall" { Invoke-UokAutoStartOperation "Uninstall" }
    "GithubPreflight" { Invoke-UokGithubPreflight }
    "GithubReadiness" { Invoke-UokGithubOperation "Readiness" }
    "GithubSecuritySetup" { Invoke-UokGithubOperation "SecuritySetup" }
    "GithubPrChecks" { Invoke-UokGithubOperation "PrChecks" }
}
