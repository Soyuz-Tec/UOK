function Assert-UokPlanningResourceAvailability {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $partyId = $null
    $calendarId = $null
    try {
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
        $calendarId = $calendar.result.id
        $event = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreateCalendarEvent"
            payload = @{
                calendar_id = $calendarId
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
                calendar_id = $calendarId
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
        return @{ calendar_id = $calendarId; party_id = $partyId }
    } catch {
        $proofError = $_
        try {
            Remove-UokPlanningAvailabilityFixture `
                -CalendarId $calendarId `
                -PartyId $partyId `
                -OpsHeaders $OpsHeaders `
                -Stamp $Stamp
        } catch {
            throw "Planning availability proof failed: $($proofError.Exception.Message). Cleanup also failed: $($_.Exception.Message)"
        }
        throw $proofError
    }
}

function Remove-UokPlanningAvailabilityFixture {
    param(
        [AllowNull()][string]$CalendarId,
        [AllowNull()][string]$PartyId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $cleanupErrors = @()
    if ($CalendarId) {
        try {
            $calendarRows = @(
                Invoke-UokJson `
                    -Path "/api/calendar/calendars?include_deleted=true" `
                    -Headers $OpsHeaders
            )
            $calendarRow = $calendarRows |
                Where-Object { $_.id -eq $CalendarId } |
                Select-Object -First 1
            if (-not $calendarRow -or -not $calendarRow.etag) {
                throw "calendar $CalendarId did not expose a lifecycle ETag"
            }
            $deleteHeaders = $OpsHeaders.Clone()
            $deleteHeaders["If-Match"] = $calendarRow.etag
            $deletedCalendar = Invoke-UokJson `
                -Method "DELETE" `
                -Path "/api/calendar/calendars/$CalendarId" `
                -Headers $deleteHeaders
            if ($deletedCalendar.status -ne "deleted") {
                throw "unexpected calendar status $($deletedCalendar.status)"
            }
        } catch {
            $cleanupErrors += "calendar: $($_.Exception.Message)"
        }
    }
    if ($PartyId) {
        try {
            $archivedParty = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
                command_type = "ArchiveContact"
                payload = @{ party_id = $PartyId }
                idempotency_key = "uok-planning-availability-party-archive-$Stamp"
            }
            if ($archivedParty.result.status -ne "archived") {
                throw "unexpected party status $($archivedParty.result.status)"
            }
        } catch {
            $cleanupErrors += "party: $($_.Exception.Message)"
        }
    }
    if ($cleanupErrors.Count) {
        throw "Planning availability fixture cleanup failed: $($cleanupErrors -join '; ')"
    }
}

function Invoke-UokPlanningAvailabilityFixtureScope {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Fixture,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )

    $scenarioResult = $null
    $scenarioError = $null
    try {
        $scenarioResult = & $Action
    } catch {
        $scenarioError = $_
    }
    $cleanupError = $null
    try {
        Remove-UokPlanningAvailabilityFixture `
            -CalendarId $Fixture.calendar_id `
            -PartyId $Fixture.party_id `
            -OpsHeaders $OpsHeaders `
            -Stamp $Stamp
    } catch {
        $cleanupError = $_
    }
    if ($scenarioError) {
        if ($cleanupError) {
            throw "Planning candidate failed: $($scenarioError.Exception.Message). Cleanup also failed: $($cleanupError.Exception.Message)"
        }
        throw $scenarioError
    }
    if ($cleanupError) {
        throw $cleanupError
    }
    return $scenarioResult
}
