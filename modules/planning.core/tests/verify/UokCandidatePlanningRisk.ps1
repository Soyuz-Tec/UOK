function Assert-UokPlanningRiskAnalysis {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][string]$SnapshotId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $payload = @{
        project_id = $ProjectId
        snapshot_id = $SnapshotId
        seed = 314159
        iterations = 100
        task_risks = @(@{
            task_id = $TaskId
            distribution = "triangular"
            minimum_days = 2
            most_likely_days = 3
            maximum_days = 6
        })
        correlations = @()
    }
    $first = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "RunPlanningRiskAnalysis"
        payload = $payload
        idempotency_key = "uok-planning-risk-first-$Stamp"
    }
    $second = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "RunPlanningRiskAnalysis"
        payload = $payload
        idempotency_key = "uok-planning-risk-second-$Stamp"
    }
    $metadata = $first.result.risk_analysis
    if (
        $metadata.engine.name -ne "uok-monte-carlo-risk" `
        -or $metadata.engine.version -ne "1" `
        -or $metadata.seed -ne 314159 `
        -or $metadata.status -ne "completed" `
        -or $metadata.integrity.verified -ne $true `
        -or $second.result.risk_analysis.checksum -ne $metadata.checksum
    ) {
        throw "Planning risk metadata or reproduction is invalid: $($first | ConvertTo-Json -Depth 30)"
    }

    $detail = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/risk-analyses/$($metadata.id)" -Headers $ViewerHeaders
    if (
        $detail.inputs.snapshot_id -ne $SnapshotId `
        -or $detail.inputs.snapshot_checksum.Length -ne 64 `
        -or $detail.result.sample_count -ne 100 `
        -or $detail.result.independent_validation.ok -ne $true `
        -or -not $detail.result.finish_percentiles.p50 `
        -or $detail.result.finish_percentiles.p50 -gt $detail.result.finish_percentiles.p95 `
        -or $detail.result.probability_on_or_before_target -lt 0 `
        -or $detail.result.probability_on_or_before_target -gt 1
    ) {
        throw "Planning risk result is invalid: $($detail | ConvertTo-Json -Depth 40)"
    }
}
