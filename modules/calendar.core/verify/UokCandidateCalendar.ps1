function Invoke-UokCalendarCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/calendar.core/install" -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Calendar install failed: $($installed | ConvertTo-Json -Depth 20)"
    }
    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer calendar creation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/calendar/calendars" -Headers $ViewerHeaders -Body @{
            name = "Denied Calendar $Stamp"
            timezone = "UTC"
        }
    }

    $calendar = Invoke-UokJson -Method "POST" -Path "/api/calendar/calendars" -Headers $OpsHeaders -Body @{
        name = "Candidate Calendar $Stamp"
        color = "#2563EB"
        timezone = "America/New_York"
    }
    if (-not $calendar.id -or $calendar.timezone -ne "America/New_York") {
        throw "Calendar creation failed: $($calendar | ConvertTo-Json -Depth 20)"
    }
    $event = Invoke-UokJson -Method "POST" -Path "/api/calendar/events" -Headers $OpsHeaders -Body @{
        calendar_id = $calendar.id
        title = "Candidate availability $Stamp"
        starts_at = "2026-08-03T13:00:00Z"
        ends_at = "2026-08-03T14:00:00Z"
        timezone = "America/New_York"
        recurrence_rule = "FREQ=WEEKLY;COUNT=2"
    }
    if (-not $event.id -or $event.calendar_id -ne $calendar.id) {
        throw "Calendar event creation failed: $($event | ConvertTo-Json -Depth 20)"
    }
    $events = Invoke-UokJson -Path "/api/calendar/events?from_at=2026-08-01T00%3A00%3A00Z&to_at=2026-08-20T00%3A00%3A00Z&calendar_id=$($calendar.id)" -Headers $ViewerHeaders
    if (@($events | Where-Object { $_.id -eq $event.id }).Count -lt 1) {
        throw "Calendar recurrence readback failed: $($events | ConvertTo-Json -Depth 20)"
    }
    return @{ calendar_id = $calendar.id; event_id = $event.id }
}
