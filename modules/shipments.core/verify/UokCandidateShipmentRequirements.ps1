function Assert-UokShipmentDocumentRequirements {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][string]$ShipmentId,
        [Parameter(Mandatory = $true)][pscustomobject]$DocumentTypes,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $optionsResponse = Invoke-UokJson -Path "/api/shipments/document-type-options" -Headers $ViewerHeaders
    $options = @($optionsResponse | ForEach-Object { $_ })
    foreach ($documentTypeId in @(
        $DocumentTypes.bill_of_lading_id,
        $DocumentTypes.certificate_of_origin_id
    )) {
        if (@($options | Where-Object {
            $_.compliance_document_type_id -eq $documentTypeId -and
            $_.status -eq "ready" -and
            $_.lifecycle_status -eq "active"
        }).Count -ne 1) {
            throw "Shipment requirement active Compliance option is missing: $documentTypeId"
        }
    }

    $required = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddShipmentDocumentRequirement"
        payload = @{
            shipment_id = $ShipmentId
            compliance_document_type_id = $DocumentTypes.bill_of_lading_id
            requirement_level = "required"
            notes = "Original bill of lading required for candidate movement."
        }
        idempotency_key = "uok-shipment-requirement-add-required-$Stamp"
    }
    if (
        -not $required.result.id -or
        $required.result.status -ne "missing" -or
        $required.result.requirement_level -ne "required" -or
        $required.result.version -ne 1 -or
        $required.result.document_type.compliance_document_type_id -ne $DocumentTypes.bill_of_lading_id -or
        $required.result.correlation_id -ne $required.command_id
    ) {
        throw "Required Shipment document link creation is invalid: $($required | ConvertTo-Json -Depth 20)"
    }
    $requiredId = $required.result.id

    $optional = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddShipmentDocumentRequirement"
        payload = @{
            shipment_id = $ShipmentId
            compliance_document_type_id = $DocumentTypes.certificate_of_origin_id
            requirement_level = "optional"
            notes = "Confirm applicability before departure."
        }
        idempotency_key = "uok-shipment-requirement-add-optional-$Stamp"
    }
    if (
        -not $optional.result.id -or
        $optional.result.status -ne "missing" -or
        $optional.result.requirement_level -ne "optional" -or
        $optional.result.version -ne 1 -or
        $optional.result.document_type.compliance_document_type_id -ne $DocumentTypes.certificate_of_origin_id
    ) {
        throw "Optional Shipment document link creation is invalid: $($optional | ConvertTo-Json -Depth 20)"
    }
    $optionalId = $optional.result.id

    Assert-UokHttpFailure `
        -StatusCode 403 `
        -UnexpectedSuccessMessage "Viewer unexpectedly changed a Shipment document requirement" `
        -Action {
            Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
                command_type = "SetShipmentDocumentRequirementStatus"
                payload = @{
                    shipment_id = $ShipmentId
                    requirement_id = $requiredId
                    expected_version = 1
                    new_status = "received"
                    reason = "Unauthorized candidate mutation"
                }
                idempotency_key = "uok-shipment-requirement-viewer-status-$Stamp"
            }
        }

    $promoted = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateShipmentDocumentRequirement"
        payload = @{
            shipment_id = $ShipmentId
            requirement_id = $optionalId
            expected_version = 1
            requirement_level = "required"
            notes = "Certificate of origin confirmed as required."
            reason = "Candidate requirement-level verification"
        }
        idempotency_key = "uok-shipment-requirement-promote-$Stamp"
    }
    if (
        $promoted.result.requirement_level -ne "required" -or
        $promoted.result.status -ne "missing" -or
        $promoted.result.version -ne 2 -or
        $promoted.result.correlation_id -ne $promoted.command_id
    ) {
        throw "Shipment document requirement update is invalid: $($promoted | ConvertTo-Json -Depth 20)"
    }

    $missing = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $missing.items.Count -ne 2 -or
        $missing.summary.required_total -ne 2 -or
        $missing.summary.required_missing -ne 2 -or
        $missing.summary.required_satisfied -ne 0 -or
        $missing.summary.optional_total -ne 0
    ) {
        throw "Shipment missing-requirement summary is invalid: $($missing | ConvertTo-Json -Depth 20)"
    }

    $planned = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "TransitionShipmentStatus"
        payload = @{
            shipment_id = $ShipmentId
            expected_version = 1
            new_status = "planned"
            reason = "Candidate proof that requirements are informational"
        }
        idempotency_key = "uok-shipment-planned-with-missing-requirements-$Stamp"
    }
    if ($planned.result.status -ne "planned" -or $planned.result.version -ne 2) {
        throw "Missing document requirements unexpectedly blocked Shipment planning"
    }

    $received = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "SetShipmentDocumentRequirementStatus"
        payload = @{
            shipment_id = $ShipmentId
            requirement_id = $requiredId
            expected_version = 1
            new_status = "received"
            reason = "Candidate document received"
        }
        idempotency_key = "uok-shipment-requirement-received-$Stamp"
    }
    $waived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "SetShipmentDocumentRequirementStatus"
        payload = @{
            shipment_id = $ShipmentId
            requirement_id = $optionalId
            expected_version = 2
            new_status = "waived"
            reason = "Candidate waiver recorded"
        }
        idempotency_key = "uok-shipment-requirement-waived-$Stamp"
    }
    if (
        $received.result.status -ne "received" -or
        $received.result.version -ne 2 -or
        $waived.result.status -ne "waived" -or
        $waived.result.version -ne 3
    ) {
        throw "Shipment document requirement status changes are invalid"
    }

    $satisfied = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $satisfied.summary.required_total -ne 2 -or
        $satisfied.summary.required_satisfied -ne 2 -or
        $satisfied.summary.required_missing -ne 0 -or
        $satisfied.summary.required_received -ne 1 -or
        $satisfied.summary.required_waived -ne 1 -or
        $satisfied.summary.required_not_applicable -ne 0 -or
        $satisfied.summary.optional_total -ne 0
    ) {
        throw "Shipment satisfied-requirement summary is invalid: $($satisfied | ConvertTo-Json -Depth 20)"
    }

    $removed = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RemoveShipmentDocumentRequirement"
        payload = @{
            shipment_id = $ShipmentId
            requirement_id = $optionalId
            expected_version = 3
            reason = "Candidate removal verification"
        }
        idempotency_key = "uok-shipment-requirement-remove-$Stamp"
    }
    if (
        $removed.result.id -ne $optionalId -or
        $removed.result.shipment_id -ne $ShipmentId -or
        $removed.result.removed -ne $true -or
        $removed.result.version -ne 4 -or
        $removed.result.correlation_id -ne $removed.command_id
    ) {
        throw "Shipment document requirement removal is invalid: $($removed | ConvertTo-Json -Depth 20)"
    }

    $historyResponse = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements/$optionalId/history" `
        -Headers $ViewerHeaders
    $history = @($historyResponse | ForEach-Object { $_ })
    if (
        $history.Count -ne 4 -or
        $history[0].action -ne "removed" -or
        @($history | Where-Object { $_.action -eq "added" }).Count -ne 1 -or
        @($history | Where-Object { $_.action -eq "updated" }).Count -ne 1 -or
        @($history | Where-Object { $_.action -eq "status_changed" }).Count -ne 1
    ) {
        throw "Shipment document requirement history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }

    $remaining = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $remaining.items.Count -ne 1 -or
        $remaining.items[0].id -ne $requiredId -or
        $remaining.summary.required_total -ne 1 -or
        $remaining.summary.required_satisfied -ne 1 -or
        $remaining.summary.required_received -ne 1
    ) {
        throw "Shipment document requirement removal summary is invalid: $($remaining | ConvertTo-Json -Depth 20)"
    }

    $deactivated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "DeactivateComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $DocumentTypes.certificate_of_origin_id
            expected_version = 1
            reason = "Candidate inactive-reference verification"
        }
        idempotency_key = "uok-shipment-document-type-deactivate-$Stamp"
    }
    if ($deactivated.result.status -ne "inactive" -or $deactivated.result.version -ne 2) {
        throw "Shipment requirement Compliance type deactivation is invalid"
    }

    foreach ($rejected in @(
        @{
            id = $DocumentTypes.certificate_of_origin_id
            key = "inactive"
        },
        @{
            id = "00000000-0000-0000-0000-000000000000"
            key = "unknown"
        }
    )) {
        Assert-UokHttpFailure `
            -StatusCode 400 `
            -UnexpectedSuccessMessage "Shipment requirement unexpectedly accepted $($rejected.key) Compliance type" `
            -Action {
                Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
                    command_type = "AddShipmentDocumentRequirement"
                    payload = @{
                        shipment_id = $ShipmentId
                        compliance_document_type_id = $rejected.id
                        requirement_level = "required"
                    }
                    idempotency_key = "uok-shipment-requirement-reject-$($rejected.key)-$Stamp"
                }
            }
    }

    Invoke-UokWithModuleDisabled -ModuleName "shipments.core" -Headers $Headers -Action {
        Assert-UokHttpFailure `
            -StatusCode 400 `
            -UnexpectedSuccessMessage "Disabled Shipment module served document requirements" `
            -Action {
                Invoke-UokJson `
                    -Path "/api/shipments/records/$ShipmentId/document-requirements" `
                    -Headers $ViewerHeaders
            }
    }
    return @{
        shipment_version = 2
        required_requirement_id = $requiredId
        removed_requirement_id = $optionalId
    }
}
