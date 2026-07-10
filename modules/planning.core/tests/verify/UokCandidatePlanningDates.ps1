function Assert-UokPlanningDateContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $invalidTimezone = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Invalid Planning timezone unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = "Invalid timezone $Stamp"; start = "2026-08-01"; end = "2026-08-20"; timezone = "Mars/Olympus" }
            idempotency_key = "uok-planning-timezone-invalid-$Stamp"
        }
    }
    if ($invalidTimezone.error.code -ne "planning_validation_failed" -or $invalidTimezone.error.field -ne "timezone") {
        throw "Planning timezone error contract is invalid: $($invalidTimezone | ConvertTo-Json -Depth 20)"
    }

    $before = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    if (
        $before.project.timezone -ne "America/New_York" `
        -or $before.date_semantics.precision -ne "calendar_date" `
        -or $before.date_semantics.subday_scales -ne "visual_only"
    ) {
        throw "Planning project timezone/date semantics are invalid: $($before | ConvertTo-Json -Depth 20)"
    }
    $headers = $OpsHeaders.Clone()
    $headers["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $headers["Idempotency-Key"] = "uok-planning-dates-$Stamp"
    $updated = Invoke-UokJson -Method "PATCH" -Path "/api/planning/tasks/$TaskId/dates" -Headers $headers -Body @{
        forecast_start = "2026-08-03"
        forecast_end = "2026-08-06"
        actual_start = "2026-08-02"
        actual_end = "2026-08-05"
        deadline = "2026-08-04"
        reason = "Candidate observed execution proof"
    }
    if (
        $updated.task.planned_start -ne "2026-08-03" `
        -or $updated.task.forecast_end_variance_days -ne 3 `
        -or $updated.task.actual_start_variance_days -ne -1 `
        -or $updated.task.deadline_variance_days -ne -1 `
        -or -not $updated.correlation_id
    ) {
        throw "Planning execution-date read model is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }

    $invalidHeaders = $OpsHeaders.Clone()
    $invalidHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $invalidHeaders["Idempotency-Key"] = "uok-planning-dates-reason-$Stamp"
    $missingReason = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Actual date without reason unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "PATCH" -Path "/api/planning/tasks/$TaskId/dates" -Headers $invalidHeaders -Body @{
            actual_end = "2026-08-06"
        }
    }
    if ($missingReason.error.code -ne "planning_actual_reason_required" -or $missingReason.error.field -ne "reason") {
        throw "Planning actual-date reason guard is invalid: $($missingReason | ConvertTo-Json -Depth 20)"
    }
}
