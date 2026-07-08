function Invoke-UokPlanningCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/planning.core/install" -Headers $Headers
    if ($installed.status -ne "installed") {
        throw "Planning install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer planning project creation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = "Denied Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20" }
            idempotency_key = "uok-planning-denied-$Stamp"
        }
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Invalid planning project unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = ""; start = "2026-08-20"; end = "2026-08-01" }
            idempotency_key = "uok-planning-invalid-$Stamp"
        }
    }

    $project = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningProject"
        payload = @{ name = "UOK Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20" }
        idempotency_key = "uok-planning-project-$Stamp"
    }
    if (-not $project.result.id) {
        throw "Planning project creation failed: $($project | ConvertTo-Json -Depth 20)"
    }
    $projectId = $project.result.id

    $projectReplay = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningProject"
        payload = @{ name = "UOK Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20" }
        idempotency_key = "uok-planning-project-$Stamp"
    }
    if (-not $projectReplay.idempotent) {
        throw "Planning idempotent replay failed: $($projectReplay | ConvertTo-Json -Depth 20)"
    }

    $first = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningTask"
        payload = @{
            project_id = $projectId
            title = "Define schedule proof"
            start = "2026-08-01"
            end = "2026-08-03"
            progress = 40
            sort_order = 1
        }
        idempotency_key = "uok-planning-task-a-$Stamp"
    }
    $second = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningTask"
        payload = @{
            project_id = $projectId
            title = "Render integrated Gantt"
            start = "2026-08-04"
            end = "2026-08-10"
            sort_order = 2
        }
        idempotency_key = "uok-planning-task-b-$Stamp"
    }
    if (-not $first.result.id -or -not $second.result.id) {
        throw "Planning task creation failed: $($first | ConvertTo-Json -Depth 20) $($second | ConvertTo-Json -Depth 20)"
    }

    $linked = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "LinkPlanningTasks"
        payload = @{
            project_id = $projectId
            predecessor_task_id = $first.result.id
            successor_task_id = $second.result.id
        }
        idempotency_key = "uok-planning-link-$Stamp"
    }
    if ($linked.result.validation.ok -ne $true) {
        throw "Planning link validation failed: $($linked | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Planning cycle unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "LinkPlanningTasks"
            payload = @{
                project_id = $projectId
                predecessor_task_id = $second.result.id
                successor_task_id = $first.result.id
            }
            idempotency_key = "uok-planning-cycle-$Stamp"
        }
    }

    $rescheduled = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdatePlanningTask"
        payload = @{ task_id = $second.result.id; start = "2026-08-05"; end = "2026-08-11" }
        idempotency_key = "uok-planning-reschedule-$Stamp"
    }
    if ($rescheduled.result.validation.ok -ne $true) {
        throw "Planning reschedule validation failed: $($rescheduled | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Invalid planning reschedule unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "UpdatePlanningTask"
            payload = @{ task_id = $second.result.id; start = "2026-08-01"; end = "2026-08-02" }
            idempotency_key = "uok-planning-invalid-reschedule-$Stamp"
        }
    }

    $schedule = Invoke-UokJson -Path "/api/planning/projects/$projectId/schedule" -Headers $ViewerHeaders
    if ($schedule.validation.ok -ne $true -or $schedule.tasks.Count -lt 2 -or $schedule.dependencies.Count -lt 1) {
        throw "Planning schedule read model failed: $($schedule | ConvertTo-Json -Depth 20)"
    }

    return @{ project_id = $projectId }
}
