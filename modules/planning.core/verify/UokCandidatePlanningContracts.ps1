function Assert-UokPlanningStatusContracts {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][long]$Stamp
    )
    $invalidHeaders = $Headers.Clone()
    $invalidHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $Headers
    $invalidHeaders["Idempotency-Key"] = "uok-planning-status-schema-$Stamp"
    $schemaError = Get-UokHttpFailureBody -StatusCode 422 -UnexpectedSuccessMessage "Unknown Planning status unexpectedly passed schema validation" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/tasks" -Headers $invalidHeaders -Body @{
            title = "Unknown status"
            start = "2026-08-03"
            end = "2026-08-04"
            status = "mystery"
        }
    }
    if ($schemaError.error.code -ne "planning_request_invalid" -or $schemaError.error.field -ne "status" -or -not $schemaError.error.correlation_id) {
        throw "Planning schema error contract is invalid: $($schemaError | ConvertTo-Json -Depth 20)"
    }

    $inProgress = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $Headers -Body @{
        command_type = "UpdatePlanningTask"
        payload = @{ task_id = $TaskId; status = "in_progress" }
        idempotency_key = "uok-planning-status-progress-$Stamp"
    }
    $complete = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $Headers -Body @{
        command_type = "UpdatePlanningTask"
        payload = @{ task_id = $TaskId; status = "complete" }
        idempotency_key = "uok-planning-status-complete-$Stamp"
    }
    if ($inProgress.result.task.status -ne "in_progress" -or $complete.result.task.status -ne "complete") {
        throw "Planning valid status transitions failed."
    }
    $transitionError = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Invalid Planning status transition unexpectedly succeeded" -Action {
        Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $Headers -Body @{
            command_type = "UpdatePlanningTask"
            payload = @{ task_id = $TaskId; status = "blocked" }
            idempotency_key = "uok-planning-status-invalid-$Stamp"
        }
    }
    if (
        $transitionError.error.code -ne "planning_status_transition_invalid" `
        -or $transitionError.error.field -ne "status" `
        -or $transitionError.error.object_ids[0] -ne $TaskId `
        -or -not $transitionError.error.repair `
        -or -not $transitionError.error.correlation_id
    ) {
        throw "Planning status transition error is invalid: $($transitionError | ConvertTo-Json -Depth 20)"
    }
    Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $Headers -Body @{
        command_type = "UpdatePlanningTask"
        payload = @{ task_id = $TaskId; status = "planned" }
        idempotency_key = "uok-planning-status-reopen-$Stamp"
    } | Out-Null
}
