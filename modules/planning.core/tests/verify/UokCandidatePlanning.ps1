. (Join-Path $PSScriptRoot "UokCandidatePlanningHttp.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningContracts.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningLinks.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningDates.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningParticipants.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningRequirements.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningResources.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningAvailability.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningLeveling.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningWhatIf.ps1")
. (Join-Path $PSScriptRoot "UokCandidatePlanningRisk.ps1")

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

    $opsCapabilities = Invoke-UokJson -Path "/api/planning/capabilities" -Headers $OpsHeaders
    $viewerCapabilities = Invoke-UokJson -Path "/api/planning/capabilities" -Headers $ViewerHeaders
    if (
        $opsCapabilities.edit -ne $true `
        -or $opsCapabilities.baseline_create -ne $true `
        -or $opsCapabilities.level -ne $true `
        -or $opsCapabilities.gate_approve -ne $true `
        -or $opsCapabilities.analyze -ne $true `
        -or $opsCapabilities.analysis_approve -ne $true `
        -or $opsCapabilities.admin -ne $true `
        -or $opsCapabilities.review_only -ne $false
    ) {
        throw "Operations Planning capability matrix is invalid: $($opsCapabilities | ConvertTo-Json -Depth 20)"
    }
    if ($viewerCapabilities.read -ne $true -or $viewerCapabilities.review_only -ne $true -or $viewerCapabilities.edit -ne $false -or $viewerCapabilities.analyze -ne $false) {
        throw "Viewer Planning capability matrix is invalid: $($viewerCapabilities | ConvertTo-Json -Depth 20)"
    }

    $deniedError = Get-UokHttpFailureBody -StatusCode 403 -UnexpectedSuccessMessage "Viewer planning project creation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = "Denied Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20" }
            idempotency_key = "uok-planning-denied-$Stamp"
        }
    }
    if (
        $deniedError.error.code -ne "permission_denied" `
        -or $deniedError.error.field -ne $null `
        -or -not $deniedError.error.repair `
        -or -not $deniedError.error.correlation_id
    ) {
        throw "Planning permission error contract is invalid: $($deniedError | ConvertTo-Json -Depth 20)"
    }

    $invalidError = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Invalid planning project unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = ""; start = "2026-08-20"; end = "2026-08-01" }
            idempotency_key = "uok-planning-invalid-$Stamp"
        }
    }

    $project = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningProject"
        payload = @{ name = "UOK Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20"; timezone = "America/New_York" }
        idempotency_key = "uok-planning-project-$Stamp"
    }
    if (-not $project.result.id -or $project.result.correlation_id -ne $project.command_id) {
        throw "Planning project creation failed: $($project | ConvertTo-Json -Depth 20)"
    }
    $projectId = $project.result.id

    $projectReplay = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningProject"
        payload = @{ name = "UOK Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20"; timezone = "America/New_York" }
        idempotency_key = "uok-planning-project-$Stamp"
    }
    if (-not $projectReplay.idempotent) {
        throw "Planning idempotent replay failed: $($projectReplay | ConvertTo-Json -Depth 20)"
    }
    $conflictError = Get-UokHttpFailureBody -StatusCode 409 -UnexpectedSuccessMessage "Planning idempotency conflict unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningProject"
            payload = @{ name = "Changed UOK Planning $Stamp"; start = "2026-08-01"; end = "2026-08-20"; timezone = "America/New_York" }
            idempotency_key = "uok-planning-project-$Stamp"
        }
    }
    if (
        $conflictError.error.code -ne "idempotency_conflict" `
        -or $conflictError.error.field -ne "idempotency_key" `
        -or $conflictError.error.correlation_id -ne $project.command_id
    ) {
        throw "Planning idempotency conflict contract is invalid: $($conflictError | ConvertTo-Json -Depth 20)"
    }
    if (
        $invalidError.error.code -ne "planning_validation_failed" `
        -or $invalidError.error.field -ne "name" `
        -or -not $invalidError.error.repair `
        -or -not $invalidError.error.correlation_id
    ) {
        throw "Planning validation error contract is invalid: $($invalidError | ConvertTo-Json -Depth 20)"
    }

    $preconditionError = Get-UokHttpFailureBody -StatusCode 428 -UnexpectedSuccessMessage "Planning mutation without If-Match unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningTask"
            payload = @{ project_id = $projectId; title = "Missing precondition"; start = "2026-08-01"; end = "2026-08-02" }
            idempotency_key = "uok-planning-missing-precondition-$Stamp"
        }
    }
    if (
        $preconditionError.error.code -ne "precondition_required" `
        -or $preconditionError.error.field -ne "If-Match" `
        -or $preconditionError.error.object_ids[0] -ne $projectId `
        -or -not $preconditionError.error.correlation_id
    ) {
        throw "Planning precondition error contract is invalid: $($preconditionError | ConvertTo-Json -Depth 20)"
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
    if (
        -not $first.result.id `
        -or -not $second.result.id `
        -or $first.result.correlation_id -ne $first.command_id `
        -or $second.result.correlation_id -ne $second.command_id
    ) {
        throw "Planning task creation failed: $($first | ConvertTo-Json -Depth 20) $($second | ConvertTo-Json -Depth 20)"
    }
    $linkProof = Assert-UokPlanningLinkContract -ProjectId $projectId -TaskId $first.result.id -Headers $Headers -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp
    Assert-UokPlanningDateContract -ProjectId $projectId -TaskId $first.result.id -OpsHeaders $OpsHeaders -Stamp $Stamp
    Assert-UokPlanningParticipantContract -ProjectId $projectId -TaskId $first.result.id -Headers $Headers -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp
    Assert-UokPlanningRequirementContract -ProjectId $projectId -TaskId $first.result.id -SourceLinkId $linkProof.party_link_id -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp
    Assert-UokPlanningStatusContracts -ProjectId $projectId -TaskId $first.result.id -Headers $OpsHeaders -Stamp $Stamp

    $beforeBatch = Invoke-UokJson -Path "/api/planning/projects/$projectId/schedule" -Headers $OpsHeaders
    $batch = Invoke-UokPlanningBatch -ProjectId $projectId -Headers $OpsHeaders -Body @{
        batch_key = $Stamp
        reason = "Candidate atomic task update"
        source_command_id = $first.command_id
        operations = @(
            @{ operation_id = "candidate-first"; kind = "update_task"; payload = @{ task_id = $first.result.id; progress = 45 } },
            @{ operation_id = "candidate-second"; kind = "update_task"; payload = @{ task_id = $second.result.id; progress = 10 } }
        )
    }
    if ($batch.revision -ne ($beforeBatch.project.revision + 1) -or $batch.operation_results.Count -ne 2) {
        throw "Planning atomic batch evidence is invalid: $($batch | ConvertTo-Json -Depth 20)"
    }
    if ($batch.source_command_id -ne $first.command_id) {
        throw "Planning atomic batch did not retain its source command: $($batch | ConvertTo-Json -Depth 20)"
    }
    if (($batch.schedule.tasks | Where-Object { $_.id -in @($first.result.id, $second.result.id) -and $_.version -lt 2 }).Count -gt 0) {
        throw "Planning atomic batch did not version changed tasks: $($batch | ConvertTo-Json -Depth 20)"
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

    $resourceEvidence = Assert-UokPlanningTypedResourceContract -ProjectId $projectId -TaskId $first.result.id -OpsHeaders $OpsHeaders -Stamp $Stamp
    $resourceId = $resourceEvidence.resource_id
    Assert-UokPlanningResourceAvailability -ProjectId $projectId -TaskId $first.result.id -OpsHeaders $OpsHeaders -Stamp $Stamp

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
    if ($schedule.calculation.resource_capacity.engine_version -ne "uok-resource-capacity-2" -or $schedule.calculation.resource_capacity.independent_validation.ok -ne $true) {
        throw "Planning resource-capacity validation failed: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if (-not $schedule.calculation.calculated_finish -or $schedule.calculation.target_finish -ne $schedule.project.end) {
        throw "Planning target/calculated finish evidence is invalid: $($schedule | ConvertTo-Json -Depth 20)"
    }
    if (($schedule.tasks | Where-Object { $_.task_type -ne "summary" -and $_.critical }).Count -lt 1) {
        throw "Planning canonical CPM did not identify a critical path: $($schedule | ConvertTo-Json -Depth 20)"
    }

    $baseline = Invoke-UokPlanningCommand -ProjectId $projectId -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningBaseline"
        payload = @{ project_id = $projectId; name = "Candidate control $Stamp" }
        idempotency_key = "uok-planning-baseline-$Stamp"
    }
    $baselineMetadata = $baseline.result.baselines[0]
    if (
        $baselineMetadata.schema_version -ne 2 `
        -or $baselineMetadata.completeness -ne "complete" `
        -or $baselineMetadata.source_revision -ne $schedule.project.revision `
        -or $baselineMetadata.integrity.verified -ne $true `
        -or $baselineMetadata.correlation_id -ne $baseline.command_id
    ) {
        throw "Planning complete baseline metadata is invalid: $($baseline | ConvertTo-Json -Depth 30)"
    }
    $baselineDetail = Invoke-UokJson -Path "/api/planning/projects/$projectId/baselines/$($baselineMetadata.id)" -Headers $ViewerHeaders
    if (
        $baselineDetail.integrity.verified -ne $true `
        -or $baselineDetail.snapshot.tasks.Count -lt 2 `
        -or $baselineDetail.snapshot.dependencies.Count -lt 1 `
        -or -not $baselineDetail.snapshot.calculation.engine_version `
        -or $baselineDetail.snapshot.project.timezone -ne "America/New_York" `
        -or $baselineDetail.snapshot.date_semantics.subday_scales -ne "visual_only" `
        -or $baselineDetail.snapshot.participants.Count -lt 1 `
        -or $baselineDetail.snapshot.requirements.Count -lt 1 `
        -or ($baselineDetail.snapshot.resources | Where-Object { $_.id -eq $resourceId } | Select-Object -First 1).capacity_unit -ne "fte" `
        -or ($baselineDetail.snapshot.resources | Where-Object { $_.id -eq $resourceId } | Select-Object -First 1).calendar.capacity_exceptions[0].capacity_percent -ne 50 `
        -or ($baselineDetail.snapshot.tasks | Where-Object { $_.id -eq $first.result.id } | Select-Object -First 1).actual_start -ne "2026-08-02" `
        -or $baselineDetail.snapshot.capture.correlation_id -ne $baseline.command_id
    ) {
        throw "Planning complete baseline readback failed: $($baselineDetail | ConvertTo-Json -Depth 30)"
    }

    Assert-UokPlanningExplainableLeveling -ProjectId $projectId -BaselineId $baselineMetadata.id -BaselineChecksum $baselineMetadata.checksum -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp
    $whatIfEvidence = Assert-UokPlanningWhatIfSnapshot -ProjectId $projectId -TaskId $first.result.id -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp
    Assert-UokPlanningRiskAnalysis -ProjectId $projectId -TaskId $first.result.id -SnapshotId $whatIfEvidence.snapshot_id -OpsHeaders $OpsHeaders -ViewerHeaders $ViewerHeaders -Stamp $Stamp

    return @{ project_id = $projectId }
}
