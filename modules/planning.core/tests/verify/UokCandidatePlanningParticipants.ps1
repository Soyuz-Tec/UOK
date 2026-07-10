function Assert-UokPlanningParticipantContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $party = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{ display_name = "Planning task participant $Stamp" }
        idempotency_key = "uok-planning-participant-party-$Stamp"
    }
    $before = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $participantHeaders = $OpsHeaders.Clone()
    $participantHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $participantHeaders["Idempotency-Key"] = "uok-planning-participant-add-$Stamp"
    $participant = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/participants" -Headers $participantHeaders -Body @{
        party_id = $party.result.id
        role = "owner"
    }
    if (
        -not $participant.id `
        -or $participant.party.id -ne $party.result.id `
        -or $participant.role -ne "owner" `
        -or $participant.resolution.status -ne "ready" `
        -or $participant.revision -ne ($before.project.revision + 1) `
        -or -not $participant.correlation_id
    ) {
        throw "Planning task participant creation is invalid: $($participant | ConvertTo-Json -Depth 20)"
    }
    $schedule = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $task = $schedule.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    if (
        $schedule.participants.Count -lt 1 `
        -or $task.participant_ids -notcontains $party.result.id `
        -or $task.participant_roles -notcontains "owner"
    ) {
        throw "Planning participant read model is invalid: $($schedule | ConvertTo-Json -Depth 20)"
    }

    $viewerMutationHeaders = $ViewerHeaders.Clone()
    $viewerMutationHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $ViewerHeaders
    $viewerMutationHeaders["Idempotency-Key"] = "uok-planning-participant-denied-$Stamp"
    $denied = Get-UokHttpFailureBody -StatusCode 403 -UnexpectedSuccessMessage "Viewer participant mutation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$TaskId/participants" -Headers $viewerMutationHeaders -Body @{
            party_id = $party.result.id
            role = "informed"
        }
    }
    if ($denied.error.code -ne "permission_denied") {
        throw "Planning participant permission denial is invalid: $($denied | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/disable" -Headers $Headers | Out-Null
    $unavailable = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $participantState = $unavailable.participants | Where-Object { $_.id -eq $participant.id } | Select-Object -First 1
    if (-not $participantState -or $participantState.resolution.status -ne "unavailable") {
        throw "Disabled Contacts provider removed or leaked the Planning participant: $($unavailable.participants | ConvertTo-Json -Depth 20)"
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/enable" -Headers $Headers | Out-Null
}
