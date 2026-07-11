function Invoke-UokPlanningReleaseReadiness {
    Invoke-UokHealth
    Invoke-UokStep "Planning candidate contracts" {
        Invoke-PowerShellScript @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".\scripts\verify_uok_candidate.ps1", "-BaseUrl", $BaseUrl)
    }
    Invoke-UokStep "Planning PostgreSQL scale budgets" {
        Invoke-Native "podman" @("exec", "uok-api-1", "python", "/app/scripts/planning_scale_benchmark.py", "--samples", "6")
    }
    Invoke-UokStep "Planning persistent CPM recovery" {
        Invoke-Native "python" @("modules/planning.core/verify/runtime/verify_planning_cpm.py", "--base-url", $BaseUrl)
    }
    Invoke-UokStep "Planning PostgreSQL concurrency recovery" {
        Invoke-Native "python" @("modules/planning.core/verify/runtime/verify_planning_postgres_concurrency.py", "--base-url", $BaseUrl)
    }
    Invoke-UokStep "Planning replay/purge lock ordering" {
        Invoke-Native "podman" @(
            "exec",
            "uok-api-1",
            "python",
            "/app/modules/planning.core/verify/runtime/verify_planning_replay_purge_concurrency.py",
            "--base-url",
            "http://127.0.0.1:8080"
        )
    }
    Push-Location web
    $previousLiveUrl = $env:UOK_LIVE_BASE_URL
    try {
        $env:UOK_LIVE_BASE_URL = $BaseUrl
        Invoke-UokStep "Planning live browser compatibility" {
            Invoke-Native "npm" @("run", "test:ui-proof", "--", "e2e/planning-live.spec.ts", "--project=chromium")
        }
    } finally {
        $env:UOK_LIVE_BASE_URL = $previousLiveUrl
        Pop-Location
    }
    Invoke-UokEngineeringEvidence
}
