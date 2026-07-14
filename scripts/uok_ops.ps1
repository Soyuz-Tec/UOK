param(
    [ValidateSet("Audit", "TechnologyAudit", "EngineeringEvidence", "UiProof", "Verify", "Rebuild", "Health", "DatabaseCapacity", "PlanningReleaseReadiness", "ContactsVerifierGroupCleanup", "BackupDb", "RestoreDb", "AsuhTest", "GithubPreflight", "GithubReadiness", "GithubSecuritySetup", "GithubPrChecks")]
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
    [string]$IncidentReason = "manual ASUH test",
    [ValidateSet("info", "warning", "critical")]
    [string]$IncidentSeverity = "warning"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

. (Join-Path $PSScriptRoot "uok_common_ops.ps1")

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

. (Join-Path $PSScriptRoot "uok_db_ops.ps1")
. (Join-Path $PSScriptRoot "uok_contacts_cleanup_ops.ps1")
. (Join-Path $PSScriptRoot "uok_planning_release_ops.ps1")

function Test-UokSourceSize {
    Invoke-UokStep "Source-size guardrail" {
        $roots = "src", "modules", "web\src", "tests", "scripts", "migrations"
        $excluded = "\\node_modules\\|\\static\\app\\|\\generated\\|__pycache__|\\.pytest_cache"
        $files = foreach ($root in $roots) {
            if (Test-Path $root) {
                Get-ChildItem $root -Recurse -File -Include *.py,*.ts,*.tsx,*.css,*.ps1,*.sql |
                    Where-Object { $_.FullName -notmatch $excluded }
            }
        }
        $violations = @()
        foreach ($file in $files) {
            $lines = (Get-Content -LiteralPath $file.FullName | Measure-Object -Line).Lines
            if ($lines -gt 300) {
                $relative = Resolve-Path -LiteralPath $file.FullName -Relative
                $violations += "${relative}: $lines lines"
            }
        }
        if ($violations.Count -gt 0) {
            throw "Source-size violations:`n$($violations -join "`n")"
        }
        Write-Host "No scanned source files over 300 lines."
    }
}

function Test-UokFolderOrganization {
    Invoke-UokStep "Folder organization" {
        $required = @(
            "docs\ARCHITECTURE.md",
            "docs\DOCUMENTATION_INDEX.md",
            "docs\architecture\UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md",
            "docs\operations\UOK_STANDARD_OPERATIONS.md",
            "docs\operations\UOK_ASUH_TEST_EVENTS.md"
        )
        foreach ($path in $required) {
            if (-not (Test-Path $path)) {
                throw "Required documentation artifact missing: $path"
            }
        }
        Get-ChildItem modules -Filter manifest.yaml -Recurse | ForEach-Object {
            $moduleRoot = Split-Path -Parent $_.FullName
            foreach ($folder in "backend", "web", "migrations", "tests") {
                if (-not (Test-Path (Join-Path $moduleRoot $folder))) {
                    throw "Module folder missing: $moduleRoot\$folder"
                }
            }
        }
        Write-Host "Required folders and documentation anchors are present."
    }
}

function Invoke-UokAudit {
    Invoke-UokStep "Git whitespace audit" { Invoke-Native "git" @("diff", "--check") }
    Invoke-UokTechnologyAudit
    Invoke-UokStep "Compile Python" { Invoke-Native "python" @("-m", "compileall", "-q", "src", "modules", "tests", "conftest.py") }
    Invoke-UokStep "Python tests" { Invoke-Native "python" @("scripts/run_python_tests.py") }
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
        Invoke-UokStep "Frontend tests" { Invoke-Native "npm" @("test") }
        Invoke-UokStep "Static frontend build" { Invoke-Native "npm" @("run", "build:static") }
    } finally {
        Pop-Location
    }
    Invoke-UokUiProof
    Invoke-UokStep "Candidate verifier" {
        Invoke-PowerShellScript @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\verify_uok_candidate.ps1", "-BaseUrl", $BaseUrl)
    }
}

function Invoke-UokRebuild {
    Invoke-UokDatabaseCapacityOffline
    Invoke-UokStep "Rebuild local Podman stack" {
        Invoke-Native "podman" @("compose", "-p", $ProjectName, "-f", $ComposeFile, "up", "-d", "--build")
    }
    Invoke-UokHealth
    Invoke-UokDatabaseCapacityLive
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
    Invoke-UokStep "ASUH candidate verifier" {
        Invoke-PowerShellScript @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\verify_uok_candidate.ps1", "-BaseUrl", $BaseUrl)
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

switch ($Action) {
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
    "GithubPreflight" { Invoke-UokGithubPreflight }
    "GithubReadiness" { Invoke-UokGithubOperation "Readiness" }
    "GithubSecuritySetup" { Invoke-UokGithubOperation "SecuritySetup" }
    "GithubPrChecks" { Invoke-UokGithubOperation "PrChecks" }
}
