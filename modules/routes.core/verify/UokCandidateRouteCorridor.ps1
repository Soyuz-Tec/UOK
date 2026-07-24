function Invoke-UokRouteCorridorCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $locationsInstalled = Invoke-UokJson -Method "POST" -Path "/api/modules/locations.core/install" -Headers $Headers
    if ($locationsInstalled.status -notin @("installed", "upgraded")) {
        throw "Route dependency install failed: $($locationsInstalled | ConvertTo-Json -Depth 20)"
    }
    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/routes.core/install" -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Route/Corridor Master install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    $locationIds = @()
    foreach ($index in 1..3) {
        $location = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreateLocationDefinition"
            payload = @{
                code = "NG-ROUTE-CANDIDATE-$index-$Stamp"
                canonical_name = "Candidate Route Location $index $Stamp"
                location_type = if ($index -eq 2) { "city" } else { "port" }
                country_code = "NG"
            }
            idempotency_key = "uok-route-location-$index-$Stamp"
        }
        if (-not $location.result.id -or $location.result.status -ne "active") {
            throw "Route Location creation is invalid: $($location | ConvertTo-Json -Depth 20)"
        }
        $locationIds += $location.result.id
    }
    $options = @(Invoke-UokJson -Path "/api/routes/location-options" -Headers $ViewerHeaders)
    foreach ($locationId in $locationIds) {
        if (@($options | Where-Object { $_.location_definition_id -eq $locationId -and $_.status -eq "ready" }).Count -ne 1) {
            throw "Route Location option is missing: $locationId"
        }
    }

    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateRouteDefinition"
        payload = @{
            code = "NG-RCN-CANDIDATE-$Stamp"
            canonical_name = "Candidate RCN Route $Stamp"
            mode_hint = "multimodal"
            origin_location_id = $locationIds[0]
            waypoint_location_ids = @($locationIds[1])
            destination_location_id = $locationIds[2]
        }
        idempotency_key = "uok-route-create-$Stamp"
    }
    if (-not $created.result.id -or $created.result.version -ne 1 -or $created.result.stops.Count -ne 3) {
        throw "Route creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    if ($created.result.correlation_id -ne $created.command_id) {
        throw "Route creation correlation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $routeId = $created.result.id
    $detail = Invoke-UokJson -Path "/api/routes/definitions/$routeId" -Headers $ViewerHeaders
    if ($detail.id -ne $routeId -or $detail.stops[0].stop_role -ne "origin" -or $detail.stops[2].stop_role -ne "destination") {
        throw "Route detail readback failed: $($detail | ConvertTo-Json -Depth 20)"
    }

    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateRouteDefinition"
        payload = @{
            route_definition_id = $routeId
            expected_version = 1
            canonical_name = "Candidate RCN Corridor $Stamp"
            mode_hint = "sea"
            origin_location_id = $locationIds[0]
            waypoint_location_ids = @()
            destination_location_id = $locationIds[2]
            reason = "Candidate route and path verification"
        }
        idempotency_key = "uok-route-update-$Stamp"
    }
    if ($updated.result.version -ne 2 -or $updated.result.mode_hint -ne "sea" -or $updated.result.stops.Count -ne 2) {
        throw "Route update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }
    $history = @(Invoke-UokJson -Path "/api/routes/definitions/$routeId/name-history" -Headers $ViewerHeaders)
    if ($history.Count -ne 1 -or $history[0].previous_name -ne "Candidate RCN Route $Stamp") {
        throw "Route name history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }

    $archived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ArchiveRouteDefinition"
        payload = @{ route_definition_id = $routeId; expected_version = 2 }
        idempotency_key = "uok-route-archive-$Stamp"
    }
    if ($archived.result.status -ne "archived" -or $archived.result.version -ne 3) {
        throw "Route archive is invalid: $($archived | ConvertTo-Json -Depth 20)"
    }
    $activeRows = @(Invoke-UokJson -Path "/api/routes/definitions" -Headers $ViewerHeaders)
    if (@($activeRows | Where-Object { $_.id -eq $routeId }).Count -ne 0) {
        throw "Archived Route leaked into the default list"
    }
    $allRows = @(Invoke-UokJson -Path "/api/routes/definitions?include_archived=true" -Headers $ViewerHeaders)
    if (@($allRows | Where-Object { $_.id -eq $routeId -and $_.status -eq "archived" }).Count -ne 1) {
        throw "Archived Route was not available through the explicit filter"
    }
    $restored = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RestoreRouteDefinition"
        payload = @{ route_definition_id = $routeId; expected_version = 3 }
        idempotency_key = "uok-route-restore-$Stamp"
    }
    if ($restored.result.status -ne "active" -or $restored.result.version -ne 4) {
        throw "Route restore is invalid: $($restored | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokWithModuleDisabled -ModuleName "routes.core" -Headers $Headers -Action {
        Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled Route module unexpectedly served definitions" -Action {
            Invoke-UokJson -Path "/api/routes/definitions" -Headers $ViewerHeaders
        }
    }
    return @{ route_definition_id = $routeId; location_definition_ids = $locationIds }
}
