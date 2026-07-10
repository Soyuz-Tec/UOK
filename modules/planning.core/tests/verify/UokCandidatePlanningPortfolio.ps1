function Assert-UokPlanningPortfolio {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $portfolio = Invoke-UokJson -Path "/api/planning/portfolio?query=$Stamp&limit=50" -Headers $ViewerHeaders
    $project = $portfolio.projects | Where-Object { $_.id -eq $ProjectId } | Select-Object -First 1
    if (
        -not $project `
        -or $portfolio.total -lt 1 `
        -or $portfolio.summary.visible_project_count -lt 1 `
        -or $portfolio.summary.task_count -lt 2 `
        -or $portfolio.diagnostics.strategy -ne "bounded_aggregate_v1" `
        -or $portfolio.diagnostics.query_count -gt 6 `
        -or $portfolio.diagnostics.elapsed_ms -lt 0
    ) {
        throw "Planning portfolio candidate evidence is invalid: $($portfolio | ConvertTo-Json -Depth 20)"
    }
}
