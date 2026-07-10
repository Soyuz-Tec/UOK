function Assert-UokPlanningGovernedOptimization {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][string]$SnapshotId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $cleanSnapshot = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningWhatIfSnapshot"
        payload = @{
            project_id = $ProjectId
            name = "Candidate optimization source $Stamp"
            task_changes = @(@{ task_id = $TaskId; progress = 55 })
        }
        idempotency_key = "uok-planning-optimization-snapshot-$Stamp"
    }
    $optimizationSnapshotId = $cleanSnapshot.result.what_if_snapshot.id
    if (-not $optimizationSnapshotId -or $SnapshotId -eq $optimizationSnapshotId) {
        throw "Planning optimization source snapshot creation failed: $($cleanSnapshot | ConvertTo-Json -Depth 30)"
    }

    $optimized = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "RunPlanningOptimization"
        payload = @{
            project_id = $ProjectId
            snapshot_id = $optimizationSnapshotId
            objective = "minimize_project_finish"
            timeout_ms = 500
            max_candidates = 50
        }
        idempotency_key = "uok-planning-optimization-$Stamp"
    }
    $metadata = $optimized.result.optimization
    $recommendation = $metadata.recommendations | Select-Object -First 1
    if (
        $metadata.engine.name -ne "uok-bounded-schedule-optimizer" `
        -or $metadata.engine.version -ne "1" `
        -or $metadata.status -ne "completed" `
        -or $metadata.integrity.verified -ne $true `
        -or $metadata.recommendation_count -lt 1 `
        -or $recommendation.preview.validation.ok -ne $true `
        -or $recommendation.status -ne "proposed" `
        -or -not $recommendation.explanation.impact `
        -or $recommendation.explanation.side_effects.Count -lt 1
    ) {
        throw "Planning optimization evidence is invalid: $($optimized | ConvertTo-Json -Depth 40)"
    }

    $approved = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "DecidePlanningRecommendation"
        payload = @{ project_id = $ProjectId; recommendation_id = $recommendation.id; decision = "approve"; reason = "Candidate owner approval" }
        idempotency_key = "uok-planning-recommendation-approve-$Stamp"
    }
    if ($approved.result.recommendation.status -ne "approved") {
        throw "Planning recommendation approval failed: $($approved | ConvertTo-Json -Depth 30)"
    }

    $applied = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "ApplyPlanningRecommendation"
        payload = @{ project_id = $ProjectId; recommendation_id = $recommendation.id }
        idempotency_key = "uok-planning-recommendation-apply-$Stamp"
    }
    $change = $recommendation.proposal.task_changes | Select-Object -First 1
    $appliedTask = $applied.result.schedule.tasks | Where-Object { $_.id -eq $change.task_id } | Select-Object -First 1
    if ($applied.result.recommendation.status -ne "applied" -or $appliedTask.end -ne $change.after.end) {
        throw "Planning recommendation apply failed: $($applied | ConvertTo-Json -Depth 40)"
    }

    $rolledBack = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "RollbackPlanningRecommendation"
        payload = @{ project_id = $ProjectId; recommendation_id = $recommendation.id }
        idempotency_key = "uok-planning-recommendation-rollback-$Stamp"
    }
    $rolledBackTask = $rolledBack.result.schedule.tasks | Where-Object { $_.id -eq $change.task_id } | Select-Object -First 1
    if ($rolledBack.result.recommendation.status -ne "rolled_back" -or $rolledBackTask.end -ne $change.before.end) {
        throw "Planning recommendation rollback failed: $($rolledBack | ConvertTo-Json -Depth 40)"
    }
}
