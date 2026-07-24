function Assert-UokPlanningRequirementContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][string]$SourceLinkId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $before = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $createHeaders = $OpsHeaders.Clone()
    $createHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $createHeaders["Idempotency-Key"] = "uok-planning-requirement-create-$Stamp"
    $created = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements" -Headers $createHeaders -Body @{
        requirement_type = "approval"
        title = "Candidate execution approval"
        required = $true
        due = "2026-08-05"
    }
    if (
        -not $created.id `
        -or $created.state -ne "missing" `
        -or $created.blocking -ne $true `
        -or $created.revision -ne ($before.project.revision + 1) `
        -or -not $created.correlation_id
    ) {
        throw "Planning requirement creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }

    $blocked = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $task = $blocked.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    if (
        $blocked.readiness.ready -ne $false `
        -or $blocked.readiness.blocking_count -lt 1 `
        -or $task.readiness.ready -ne $false `
        -or $task.readiness.blocking_requirement_ids -notcontains $created.id
    ) {
        throw "Planning requirement did not block readiness: $($blocked | ConvertTo-Json -Depth 20)"
    }

    $submitHeaders = $OpsHeaders.Clone()
    $submitHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $submitHeaders["Idempotency-Key"] = "uok-planning-requirement-submit-$Stamp"
    $submitted = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/advance" -Headers $submitHeaders -Body @{
        action = "submit"
    }
    if ($submitted.state -ne "submitted") {
        throw "Planning requirement submission is invalid: $($submitted | ConvertTo-Json -Depth 20)"
    }

    $reviewHeaders = $OpsHeaders.Clone()
    $reviewHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $reviewHeaders["Idempotency-Key"] = "uok-planning-requirement-review-$Stamp"
    $reviewing = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/advance" -Headers $reviewHeaders -Body @{
        action = "start_review"
    }
    if ($reviewing.state -ne "under_review") {
        throw "Planning requirement review transition is invalid: $($reviewing | ConvertTo-Json -Depth 20)"
    }

    $viewerHeaders = $ViewerHeaders.Clone()
    $viewerHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $ViewerHeaders
    $viewerHeaders["Idempotency-Key"] = "uok-planning-requirement-denied-$Stamp"
    $denied = Get-UokHttpFailureBody -StatusCode 403 -UnexpectedSuccessMessage "Viewer gate decision unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/decision" -Headers $viewerHeaders -Body @{
            decision = "satisfy"
            reason = "Unauthorized candidate decision"
        }
    }
    if ($denied.error.code -ne "permission_denied") {
        throw "Planning requirement permission denial is invalid: $($denied | ConvertTo-Json -Depth 20)"
    }

    $sourceHeaders = $OpsHeaders.Clone()
    $sourceHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $sourceHeaders["Idempotency-Key"] = "uok-planning-requirement-source-$Stamp"
    $source = Invoke-UokJson -Method "PUT" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/link" -Headers $sourceHeaders -Body @{
        target_link_id = $SourceLinkId
    }
    if ($source.target_link_id -ne $SourceLinkId -or $source.target_link_state -ne "ready" -or $source.state -ne "submitted") {
        throw "Planning requirement source replacement did not invalidate active review: $($source | ConvertTo-Json -Depth 20)"
    }

    $sourceReviewHeaders = $OpsHeaders.Clone()
    $sourceReviewHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $sourceReviewHeaders["Idempotency-Key"] = "uok-planning-requirement-source-review-$Stamp"
    $sourceReview = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/advance" -Headers $sourceReviewHeaders -Body @{
        action = "start_review"
    }
    if ($sourceReview.state -ne "under_review") {
        throw "Planning requirement replacement review transition is invalid: $($sourceReview | ConvertTo-Json -Depth 20)"
    }

    $decisionHeaders = $OpsHeaders.Clone()
    $decisionHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $decisionHeaders["Idempotency-Key"] = "uok-planning-requirement-decision-$Stamp"
    $decided = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/requirements/$($created.id)/decision" -Headers $decisionHeaders -Body @{
        decision = "satisfy"
        reason = "Candidate approval reviewed and accepted"
    }
    if (
        $decided.state -ne "satisfied" `
        -or $decided.blocking -ne $false `
        -or $decided.decision_reason -ne "Candidate approval reviewed and accepted" `
        -or -not $decided.decided_by_actor_id `
        -or -not $decided.decided_at
    ) {
        throw "Planning requirement decision is invalid: $($decided | ConvertTo-Json -Depth 20)"
    }
    $ready = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    if ($ready.readiness.ready -ne $true -or $ready.requirements.Count -lt 1) {
        throw "Planning requirement readiness did not recover: $($ready | ConvertTo-Json -Depth 20)"
    }
}
