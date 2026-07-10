function Get-UokPlanningEtag {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$Headers
    )
    $response = Invoke-WebRequest -UseBasicParsing -Method "GET" -Uri "$BaseUrl/api/planning/projects/$ProjectId/schedule" -Headers $Headers
    $etag = [string]$response.Headers["ETag"]
    if (-not $etag -or $etag -notmatch '^"planning-r[1-9][0-9]*-sha256-[a-f0-9]{64}"$') {
        throw "Planning schedule did not return a valid strong ETag: $etag"
    }
    return $etag
}

function Invoke-UokPlanningCommand {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )
    $conditionalHeaders = $Headers.Clone()
    $conditionalHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $Headers
    return Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $conditionalHeaders -Body $Body
}

function Invoke-UokPlanningCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $calendarInstalled = Invoke-UokJson -Method "POST" -Path "/api/modules/calendar.core/install" -Headers $Headers
    if ($calendarInstalled.status -ne "installed") {
        throw "Calendar dependency install failed: $($calendarInstalled | ConvertTo-Json -Depth 20)"
    }

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

    Assert-UokHttpFailure -StatusCode 428 -UnexpectedSuccessMessage "Planning mutation without If-Match unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningTask"
            payload = @{ project_id = $projectId; title = "Missing precondition"; start = "2026-08-01"; end = "2026-08-02" }
            idempotency_key = "uok-planning-missing-precondition-$Stamp"
        }
    }

    $first = Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
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
    $second = Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
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

    $linked = Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
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
        Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
            command_type = "LinkPlanningTasks"
            payload = @{
                project_id = $projectId
                predecessor_task_id = $second.result.id
                successor_task_id = $first.result.id
            }
            idempotency_key = "uok-planning-cycle-$Stamp"
        }
    }

    $rescheduled = Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
        command_type = "UpdatePlanningTask"
        payload = @{ task_id = $second.result.id; start = "2026-08-05"; end = "2026-08-11" }
        idempotency_key = "uok-planning-reschedule-$Stamp"
    }
    if ($rescheduled.result.validation.ok -ne $true) {
        throw "Planning reschedule validation failed: $($rescheduled | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Invalid planning reschedule unexpectedly succeeded" -Action {
        Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
            command_type = "UpdatePlanningTask"
            payload = @{ task_id = $second.result.id; start = "2026-08-01"; end = "2026-08-02" }
            idempotency_key = "uok-planning-invalid-reschedule-$Stamp"
        }
    }

    $schedule = Invoke-UokJson -Path "/api/planning/projects/$projectId/schedule" -Headers $ViewerHeaders
    if ($schedule.validation.ok -ne $true -or $schedule.tasks.Count -lt 2 -or $schedule.dependencies.Count -lt 1) {
        throw "Planning schedule read model failed: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if ($schedule.availability.source_module -ne "calendar.core") {
        throw "Planning did not consume calendar.core availability: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if ($schedule.project.revision -lt 5 -or ($schedule.tasks | Where-Object { $_.version -lt 1 }).Count -gt 0) {
        throw "Planning revision/version evidence is invalid: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if ($schedule.calculation.engine_version -ne "uok-cpm-1" -or $schedule.calculation.independent_validation.ok -ne $true) {
        throw "Planning canonical CPM validation failed: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if (-not $schedule.calculation.calculated_finish -or $schedule.calculation.target_finish -ne $schedule.project.end) {
        throw "Planning target/calculated finish evidence is invalid: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if (($schedule.tasks | Where-Object { $_.task_type -ne "summary" -and $_.critical }).Count -lt 1) {
        throw "Planning canonical CPM did not identify a critical path: $($schedule | ConvertTo-Json -Depth 20)"
    }

    return @{ project_id = $projectId }
}
