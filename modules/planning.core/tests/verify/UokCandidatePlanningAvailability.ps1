function Assert-UokPlanningResourceAvailability {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $party = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{ display_name = "Candidate availability party $Stamp"; visibility_scope = "organization" }
        idempotency_key = "uok-planning-availability-party-$Stamp"
    }
    $partyId = $party.result.contact_id
    $calendar = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateCalendar"
        payload = @{ name = "Candidate availability $Stamp"; timezone = "UTC" }
        idempotency_key = "uok-planning-availability-calendar-$Stamp"
    }
    $event = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateCalendarEvent"
        payload = @{
            calendar_id = $calendar.result.id
            title = "Candidate linked busy time"
            starts_at = "2026-08-03T13:00:00+00:00"
            ends_at = "2026-08-03T14:00:00+00:00"
            timezone = "UTC"
            participants = @(@{ participant_type = "party"; participant_id = $partyId; display_name = "Candidate party" })
        }
        idempotency_key = "uok-planning-availability-event-$Stamp"
    }
    Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateCalendarEvent"
        payload = @{
            calendar_id = $calendar.result.id
            title = "Candidate unrelated busy time"
            starts_at = "2026-08-03T13:00:00+00:00"
            ends_at = "2026-08-03T14:00:00+00:00"
            timezone = "UTC"
        }
        idempotency_key = "uok-planning-unrelated-event-$Stamp"
    } | Out-Null
    $resource = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningResource"
        payload = @{
            project_id = $ProjectId
            name = "Candidate linked party resource"
            resource_type = "human"
            capacity_unit = "fte"
            canonical_target_kind = "party"
            canonical_target_id = $partyId
        }
        idempotency_key = "uok-planning-availability-resource-$Stamp"
    }
    $resourceId = ($resource.result.resources | Where-Object { $_.name -eq "Candidate linked party resource" } | Select-Object -First 1).id
    $assigned = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "AssignPlanningResource"
        payload = @{ task_id = $TaskId; resource_id = $resourceId; allocation_percent = 100 }
        idempotency_key = "uok-planning-availability-assignment-$Stamp"
    }
    $availability = $assigned.result.availability
    $busy = $availability.busy | Where-Object { $_.event_id -eq $event.result.id } | Select-Object -First 1
    if (
        $availability.scope -ne "task_parties" `
        -or $availability.correlation.party_count -lt 1 `
        -or $busy.task_ids[0] -ne $TaskId `
        -or @($availability.busy | Where-Object { $_.title -eq "Candidate unrelated busy time" }).Count -ne 0 `
        -or @($availability.warnings | Where-Object { $_ -like "*Candidate linked busy time*" }).Count -lt 1
    ) {
        throw "Planning resource-specific calendar correlation is invalid: $($assigned | ConvertTo-Json -Depth 30)"
    }
}
