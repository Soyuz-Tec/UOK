. (Join-Path $PSScriptRoot "UokCandidateShipmentRequirementTypes.ps1")
. (Join-Path $PSScriptRoot "UokCandidateShipmentRequirements.ps1")

function Invoke-UokShipmentSupportCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    foreach ($moduleName in @(
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
        "shipments.core"
    )) {
        $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/$moduleName/install" -Headers $Headers
        if ($installed.status -notin @("installed", "upgraded")) {
            throw "Shipment dependency install failed for ${moduleName}: $($installed | ConvertTo-Json -Depth 20)"
        }
    }

    $documentTypes = New-UokShipmentRequirementDocumentTypes `
        -OpsHeaders $OpsHeaders `
        -Stamp $Stamp

    $shipper = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{
            party_type = "organization"
            display_name = "Candidate RCN Shipper $Stamp"
        }
        idempotency_key = "uok-shipment-shipper-$Stamp"
    }
    $consignee = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{
            party_type = "organization"
            display_name = "Candidate VOC Consignee $Stamp"
        }
        idempotency_key = "uok-shipment-consignee-$Stamp"
    }
    if (-not $shipper.result.contact_id -or -not $consignee.result.contact_id) {
        throw "Shipment Party creation is invalid"
    }

    $origin = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateLocationDefinition"
        payload = @{
            code = "NG-SHIPMENT-ORIGIN-$Stamp"
            canonical_name = "Candidate Africa Origin $Stamp"
            location_type = "port"
            country_code = "NG"
        }
        idempotency_key = "uok-shipment-origin-$Stamp"
    }
    $destination = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateLocationDefinition"
        payload = @{
            code = "IN-SHIPMENT-VOC-$Stamp"
            canonical_name = "Candidate V.O.C. Port $Stamp"
            location_type = "port"
            country_code = "IN"
        }
        idempotency_key = "uok-shipment-destination-$Stamp"
    }
    if (-not $origin.result.id -or -not $destination.result.id) {
        throw "Shipment Location creation is invalid"
    }

    $route = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateRouteDefinition"
        payload = @{
            code = "RCN-SHIPMENT-ROUTE-$Stamp"
            canonical_name = "Candidate Africa to V.O.C. Corridor $Stamp"
            mode_hint = "sea"
            origin_location_id = $origin.result.id
            waypoint_location_ids = @()
            destination_location_id = $destination.result.id
        }
        idempotency_key = "uok-shipment-route-$Stamp"
    }
    if (-not $route.result.id -or $route.result.stops.Count -ne 2) {
        throw "Shipment Route creation is invalid: $($route | ConvertTo-Json -Depth 20)"
    }

    $locationOptionsResponse = Invoke-UokJson -Path "/api/shipments/location-options" -Headers $ViewerHeaders
    $locationOptions = @($locationOptionsResponse | ForEach-Object { $_ })
    foreach ($locationId in @($origin.result.id, $destination.result.id)) {
        if (@($locationOptions | Where-Object {
            $_.location_definition_id -eq $locationId -and $_.status -eq "ready"
        }).Count -ne 1) {
            throw "Shipment Location option is missing: $locationId"
        }
    }
    $routeOptionsResponse = Invoke-UokJson -Path "/api/shipments/route-options" -Headers $ViewerHeaders
    $routeOptions = @($routeOptionsResponse | ForEach-Object { $_ })
    if (@($routeOptions | Where-Object {
        $_.route_definition_id -eq $route.result.id -and
        $_.status -eq "ready" -and
        $_.ordered_location_ids.Count -eq 2
    }).Count -ne 1) {
        throw "Shipment Route option is missing or does not expose its governed path"
    }
    $partyReference = Invoke-UokJson `
        -Path "/api/shipments/party-references/$($shipper.result.contact_id)" `
        -Headers $ViewerHeaders
    if ($partyReference.status -ne "ready" -or $partyReference.display_label -ne "Candidate RCN Shipper $Stamp") {
        throw "Shipment Party resolution is invalid: $($partyReference | ConvertTo-Json -Depth 20)"
    }

    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateShipment"
        payload = @{
            code = "RCN-AFRICA-VOC-$Stamp"
            shipper_party_id = $shipper.result.contact_id
            consignee_party_id = $consignee.result.contact_id
            origin_location_id = $origin.result.id
            destination_location_id = $destination.result.id
            route_definition_id = $route.result.id
            planned_departure_on = "2026-08-01"
            planned_arrival_on = "2026-08-21"
        }
        idempotency_key = "uok-shipment-create-$Stamp"
    }
    if (
        -not $created.result.id -or
        $created.result.status -ne "draft" -or
        $created.result.version -ne 1 -or
        $created.result.route.ordered_location_ids.Count -ne 2
    ) {
        throw "Shipment creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    if ($created.result.correlation_id -ne $created.command_id) {
        throw "Shipment creation correlation is invalid"
    }
    $shipmentId = $created.result.id

    $requirementProof = Assert-UokShipmentDocumentRequirements `
        -Headers $Headers `
        -OpsHeaders $OpsHeaders `
        -ViewerHeaders $ViewerHeaders `
        -ShipmentId $shipmentId `
        -DocumentTypes $documentTypes `
        -Stamp $Stamp

    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateShipment"
        payload = @{
            shipment_id = $shipmentId
            expected_version = $requirementProof.shipment_version
            planned_departure_on = "2026-08-02"
            planned_arrival_on = "2026-08-22"
        }
        idempotency_key = "uok-shipment-update-$Stamp"
    }
    if ($updated.result.version -ne 3 -or $updated.result.planned_departure_on -ne "2026-08-02") {
        throw "Shipment update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }

    $version = 3
    foreach ($transition in @(
        @{ status = "in_transit"; reason = "Candidate departed origin" },
        @{ status = "arrived"; reason = "Candidate arrived at V.O.C." },
        @{ status = "closed"; reason = "Candidate movement complete" }
    )) {
        $result = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "TransitionShipmentStatus"
            payload = @{
                shipment_id = $shipmentId
                expected_version = $version
                new_status = $transition.status
                reason = $transition.reason
            }
            idempotency_key = "uok-shipment-$($transition.status)-$Stamp"
        }
        $version += 1
        if ($result.result.status -ne $transition.status -or $result.result.version -ne $version) {
            throw "Shipment transition is invalid: $($result | ConvertTo-Json -Depth 20)"
        }
    }

    $detail = Invoke-UokJson -Path "/api/shipments/records/$shipmentId" -Headers $ViewerHeaders
    if ($detail.status -ne "closed" -or $detail.shipper.status -ne "ready" -or $detail.route.status -ne "ready") {
        throw "Shipment detail readback failed: $($detail | ConvertTo-Json -Depth 20)"
    }
    $historyResponse = Invoke-UokJson -Path "/api/shipments/records/$shipmentId/status-history" -Headers $ViewerHeaders
    $history = @($historyResponse | ForEach-Object { $_ })
    if ($history.Count -ne 4 -or $history[0].new_status -ne "closed" -or $history[3].new_status -ne "planned") {
        throw "Shipment status history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokWithModuleDisabled -ModuleName "shipments.core" -Headers $Headers -Action {
        Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled Shipment module served records" -Action {
            Invoke-UokJson -Path "/api/shipments/records" -Headers $ViewerHeaders
        }
    }
    return @{
        shipment_id = $shipmentId
        shipper_party_id = $shipper.result.contact_id
        consignee_party_id = $consignee.result.contact_id
        origin_location_id = $origin.result.id
        destination_location_id = $destination.result.id
        route_definition_id = $route.result.id
        bill_of_lading_document_type_id = $documentTypes.bill_of_lading_id
        required_document_requirement_id = $requirementProof.required_requirement_id
    }
}
