function Assert-UokPlanningFinishAuthority {
    param([Parameter(Mandatory = $true)][object]$Schedule)

    if ($Schedule.calculation.engine_version -ne "uok-cpm-2" -or $Schedule.calculation.independent_validation.ok -ne $true) {
        throw "Planning canonical CPM validation failed: $($Schedule | ConvertTo-Json -Depth 20)"
    }
    if ($Schedule.calculation.resource_capacity.engine_version -ne "uok-resource-capacity-2" -or $Schedule.calculation.resource_capacity.independent_validation.ok -ne $true) {
        throw "Planning resource-capacity validation failed: $($Schedule | ConvertTo-Json -Depth 20)"
    }
    if (
        -not $Schedule.calculation.calculated_finish `
        -or $Schedule.calculation.target_finish -ne $Schedule.project.end `
        -or $Schedule.project.target_finish -ne $Schedule.project.end `
        -or $Schedule.project.target_finish -ne $Schedule.calculation.target_finish `
        -or $Schedule.project.calculated_finish -ne $Schedule.calculation.calculated_finish
    ) {
        throw "Planning target/calculated finish evidence is invalid: $($Schedule | ConvertTo-Json -Depth 20)"
    }
    if (($Schedule.tasks | Where-Object { $_.task_type -ne "summary" -and $_.critical }).Count -lt 1) {
        throw "Planning canonical CPM did not identify a critical path: $($Schedule | ConvertTo-Json -Depth 20)"
    }
}

function Assert-UokPlanningProjectLifecycle {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][object]$Schedule,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $targetFinish = $Schedule.project.target_finish
    $calculatedFinish = $Schedule.project.calculated_finish
    $archiveHeaders = $OpsHeaders.Clone()
    $archiveHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $archiveHeaders["Idempotency-Key"] = "uok-planning-archive-$Stamp"
    $archived = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/transitions" -Headers $archiveHeaders -Body @{
        target_status = "archived"
        reason = "Candidate lifecycle retention proof"
    }
    if ($archived.status -ne "archived" -or -not $archived.correlation_id) {
        throw "Planning project archive transition failed: $($archived | ConvertTo-Json -Depth 20)"
    }

    $archivedReplay = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/transitions" -Headers $archiveHeaders -Body @{
        target_status = "archived"
        reason = "Candidate lifecycle retention proof"
    }
    $archivedPairs = @($archived.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" })
    $replayPairs = @($archivedReplay.PSObject.Properties | Sort-Object Name | ForEach-Object { "$($_.Name)=$($_.Value)" })
    if (Compare-Object -ReferenceObject $archivedPairs -DifferenceObject $replayPairs) {
        throw "Planning project archive replay drifted from its stored result: $($archivedReplay | ConvertTo-Json -Depth 20)"
    }

    $archivedSchedule = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $ViewerHeaders
    if (
        $archivedSchedule.project.status -ne "archived" `
        -or $archivedSchedule.project.target_finish -ne $targetFinish `
        -or $archivedSchedule.project.calculated_finish -ne $calculatedFinish
    ) {
        throw "Archived Planning project was not retained as a stable readable schedule: $($archivedSchedule | ConvertTo-Json -Depth 20)"
    }

    $blocked = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Archived Planning project mutation unexpectedly succeeded" -Action {
        Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
            command_type = "UpdatePlanningTask"
            payload = @{ task_id = $TaskId; progress = 99 }
            idempotency_key = "uok-planning-archived-block-$Stamp"
        }
    }
    if ($blocked.error.code -ne "planning_project_archived" -or -not $blocked.error.correlation_id) {
        throw "Archived Planning mutation guard returned invalid evidence: $($blocked | ConvertTo-Json -Depth 20)"
    }

    $restoreHeaders = $OpsHeaders.Clone()
    $restoreHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $restoreHeaders["Idempotency-Key"] = "uok-planning-restore-$Stamp"
    $restored = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/transitions" -Headers $restoreHeaders -Body @{
        target_status = "active"
        reason = "Candidate lifecycle restoration proof"
    }
    if ($restored.status -ne "active" -or -not $restored.correlation_id) {
        throw "Planning project restore transition failed: $($restored | ConvertTo-Json -Depth 20)"
    }
    $restoredSchedule = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $ViewerHeaders
    if (
        $restoredSchedule.project.status -ne "active" `
        -or $restoredSchedule.project.target_finish -ne $targetFinish `
        -or $restoredSchedule.project.calculated_finish -ne $calculatedFinish
    ) {
        throw "Restored Planning schedule changed its finish authority: $($restoredSchedule | ConvertTo-Json -Depth 20)"
    }
}
