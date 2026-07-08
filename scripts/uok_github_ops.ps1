param(
    [ValidateSet("Readiness", "SecuritySetup", "PrChecks")]
    [string]$Action = "Readiness",
    [string]$Repo = "Soyuz-Tec/UOK",
    [int]$PullRequestNumber = 0,
    [switch]$WatchChecks
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

. (Join-Path $PSScriptRoot "uok_common_ops.ps1")

function Invoke-GhAllowFailure {
    param([string[]]$Arguments)
    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process `
            -FilePath "gh" `
            -ArgumentList $Arguments `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -WindowStyle Hidden `
            -Wait `
            -PassThru
        $stdout = Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue
        $stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
        [pscustomobject]@{
            ExitCode = $process.ExitCode
            Output = "$stdout$stderr".Trim()
        }
    } finally {
        Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-CurrentBranch {
    (& git branch --show-current).Trim()
}

function Get-CurrentPullRequestNumber {
    if ($PullRequestNumber -gt 0) {
        return $PullRequestNumber
    }
    $branch = Get-CurrentBranch
    $result = Invoke-GhAllowFailure @(
        "pr", "list", "--repo", $Repo, "--head", $branch, "--state", "open",
        "--limit", "1", "--json", "number", "--jq", ".[0].number"
    )
    if ($result.ExitCode -eq 0 -and $result.Output) {
        return [int]$result.Output
    }
    return 0
}

function Write-ApiStatus {
    param([string]$Label, [string[]]$Arguments)
    $result = Invoke-GhAllowFailure $Arguments
    if ($result.ExitCode -eq 0) {
        Write-Host "$Label`: ready"
    } else {
        Write-Host "$Label`: unavailable or blocked"
        Write-Host $result.Output
    }
}

function Invoke-GithubUpstreamCheck {
    Invoke-UokStep "Git upstream state" {
        Invoke-Native "git" @("fetch", "--prune")
        $upstream = & git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
        if (-not $upstream) {
            throw "Current branch has no upstream branch."
        }
        $counts = (& git rev-list --left-right --count "$upstream...HEAD").Trim() -split "\s+"
        Write-Host "Branch: $(Get-CurrentBranch)"
        Write-Host "Upstream: $upstream"
        Write-Host "Behind: $($counts[0])"
        Write-Host "Ahead: $($counts[1])"
        if ([int]$counts[0] -gt 0) {
            throw "Local branch is behind upstream. Reconcile before publishing."
        }
    }
}

function Invoke-GithubReadiness {
    Invoke-UokStep "GitHub authentication" {
        Invoke-Native "gh" @("auth", "status")
    }
    Invoke-UokStep "Repository summary" {
        Invoke-Native "gh" @("repo", "view", $Repo, "--json", "nameWithOwner,defaultBranchRef,viewerPermission,isPrivate,url")
    }
    Invoke-GithubUpstreamCheck
    Invoke-UokStep "Latest branch runs" {
        $branch = Get-CurrentBranch
        Invoke-Native "gh" @(
            "run", "list", "--repo", $Repo, "--branch", $branch, "--limit", "5",
            "--json", "databaseId,workflowName,displayTitle,status,conclusion,headSha,url"
        )
    }
    Invoke-UokStep "Pull request status" {
        $pr = Get-CurrentPullRequestNumber
        if ($pr -eq 0) {
            Write-Host "No pull request found for the current branch."
            return
        }
        Invoke-Native "gh" @(
            "pr", "view", $pr, "--repo", $Repo,
            "--json", "number,title,state,isDraft,mergeable,reviewDecision,statusCheckRollup,url,headRefName,baseRefName"
        )
    }
    Invoke-UokStep "Security and enforcement availability" {
        Write-ApiStatus "Dependabot vulnerability alerts" @("api", "repos/$Repo/vulnerability-alerts", "-i")
        Write-ApiStatus "Branch protection" @("api", "repos/$Repo/branches/main/protection")
        Write-ApiStatus "Repository rulesets" @("api", "repos/$Repo/rulesets")
    }
}

function Invoke-GithubSecuritySetup {
    Invoke-UokStep "Enable Dependabot vulnerability alerts" {
        Invoke-Native "gh" @("api", "repos/$Repo/vulnerability-alerts", "--method", "PUT", "-i")
    }
    Invoke-UokStep "Enable Dependabot security updates" {
        Invoke-Native "gh" @("api", "repos/$Repo/automated-security-fixes", "--method", "PUT", "-i")
    }
    Invoke-UokStep "Configure merge hygiene" {
        Invoke-Native "gh" @(
            "api", "repos/$Repo", "-X", "PATCH",
            "-f", "delete_branch_on_merge=true",
            "-f", "allow_squash_merge=true",
            "-f", "allow_merge_commit=false",
            "-f", "allow_rebase_merge=true",
            "--jq", "{allow_squash_merge,allow_merge_commit,allow_rebase_merge,delete_branch_on_merge}"
        )
    }
    Invoke-UokStep "Report protected-branch availability" {
        Write-ApiStatus "Branch protection" @("api", "repos/$Repo/branches/main/protection")
        Write-ApiStatus "Repository rulesets" @("api", "repos/$Repo/rulesets")
    }
}

function Invoke-GithubPrChecks {
    $pr = Get-CurrentPullRequestNumber
    if ($pr -eq 0) {
        throw "No pull request found. Pass -PullRequestNumber or open a PR for this branch."
    }
    Invoke-UokStep "Pull request checks" {
        if ($WatchChecks) {
            Invoke-Native "gh" @("pr", "checks", $pr, "--repo", $Repo, "--watch")
        } else {
            Invoke-Native "gh" @("pr", "checks", $pr, "--repo", $Repo)
        }
    }
}

switch ($Action) {
    "Readiness" { Invoke-GithubReadiness }
    "SecuritySetup" { Invoke-GithubSecuritySetup }
    "PrChecks" { Invoke-GithubPrChecks }
}
