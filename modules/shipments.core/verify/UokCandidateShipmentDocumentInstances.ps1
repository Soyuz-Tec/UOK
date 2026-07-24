. (Join-Path $PSScriptRoot "UokCandidateShipmentDocumentInstanceGuards.ps1")

function Assert-UokShipmentDocumentInstances {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][string]$ShipmentId,
        [Parameter(Mandatory = $true)][pscustomobject]$DocumentTypes,
        [Parameter(Mandatory = $true)][long]$Stamp
    )
    $optionsResponse = Invoke-UokJson -Path "/api/shipments/document-type-options" -Headers $ViewerHeaders
    $invoiceOption = @($optionsResponse | Where-Object {
        $_.compliance_document_type_id -eq $DocumentTypes.commercial_invoice_id -and
        $_.status -eq "ready" -and
        $_.lifecycle_status -eq "active"
    })
    if ($invoiceOption.Count -ne 1) {
        throw "Shipment document-instance Commercial Invoice option is missing"
    }
    $requirement = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddShipmentDocumentRequirement"
        payload = @{
            shipment_id = $ShipmentId
            compliance_document_type_id = $DocumentTypes.commercial_invoice_id
            requirement_level = "required"
            notes = "Commercial invoice metadata required for candidate movement."
        }
        idempotency_key = "uok-shipment-instance-requirement-add-$Stamp"
    }
    if (
        -not $requirement.result.id -or
        $requirement.result.status -ne "missing" -or
        $requirement.result.version -ne 1
    ) {
        throw "Shipment document-instance requirement creation is invalid: $($requirement | ConvertTo-Json -Depth 20)"
    }
    $requirementId = $requirement.result.id
    $missing = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $missing.summary.required_total -ne 2 -or
        $missing.summary.required_satisfied -ne 1 -or
        $missing.summary.required_missing -ne 1 -or
        $missing.summary.required_received -ne 1
    ) {
        throw "Shipment document-instance initial readiness is invalid: $($missing | ConvertTo-Json -Depth 20)"
    }
    Assert-UokShipmentDocumentInstanceGuards `
        -OpsHeaders $OpsHeaders `
        -ViewerHeaders $ViewerHeaders `
        -ShipmentId $ShipmentId `
        -DocumentTypes $DocumentTypes `
        -RequirementId $requirementId `
        -Stamp $Stamp
    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateShipmentDocumentInstance"
        payload = @{
            shipment_id = $ShipmentId
            compliance_document_type_id = $DocumentTypes.commercial_invoice_id
            requirement_id = $requirementId
            document_number = "CI-$Stamp-001"
            issuing_party_name = "Candidate RCN Exporter $Stamp"
            issued_on = "2026-07-20"
            expires_on = "2026-10-20"
            notes = "Metadata only; no binary asset exists."
        }
        idempotency_key = "uok-shipment-instance-create-$Stamp"
    }
    if (
        -not $created.result.id -or
        $created.result.status -ne "draft" -or
        $created.result.version -ne 1 -or
        $created.result.requirement_id -ne $requirementId -or
        $created.result.requirement.status -ne "missing" -or
        $created.result.document_type.compliance_document_type_id -ne $DocumentTypes.commercial_invoice_id -or
        $created.result.correlation_id -ne $created.command_id
    ) {
        throw "Shipment document-instance creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $instanceId = $created.result.id
    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateShipmentDocumentInstance"
        payload = @{
            shipment_id = $ShipmentId
            instance_id = $instanceId
            expected_version = 1
            document_number = "CI-$Stamp-002"
            issuing_party_name = "Candidate RCN Trading Exporter $Stamp"
            issued_on = "2026-07-21"
            expires_on = "2026-10-21"
            notes = "Corrected metadata; still no binary asset."
            reason = "Candidate metadata correction"
        }
        idempotency_key = "uok-shipment-instance-update-$Stamp"
    }
    if (
        $updated.result.document_number -ne "CI-$Stamp-002" -or
        $updated.result.status -ne "draft" -or
        $updated.result.version -ne 2
    ) {
        throw "Shipment document-instance update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }
    $recorded = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "SetShipmentDocumentInstanceStatus"
        payload = @{
            shipment_id = $ShipmentId
            instance_id = $instanceId
            expected_version = 2
            new_status = "recorded"
            reason = "Candidate metadata recorded"
            mark_requirement_received = $false
        }
        idempotency_key = "uok-shipment-instance-recorded-$Stamp"
    }
    if (
        $recorded.result.status -ne "recorded" -or
        $recorded.result.version -ne 3 -or
        $recorded.result.requirement.status -ne "missing" -or
        $recorded.result.requirement.version -ne 1
    ) {
        throw "Shipment document-instance recording is invalid: $($recorded | ConvertTo-Json -Depth 20)"
    }
    $stillMissing = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $stillMissing.summary.required_missing -ne 1 -or
        $stillMissing.summary.required_satisfied -ne 1
    ) {
        throw "Recorded metadata unexpectedly changed Shipment readiness"
    }
    $verifyBody = @{
        command_type = "SetShipmentDocumentInstanceStatus"
        payload = @{
            shipment_id = $ShipmentId
            instance_id = $instanceId
            expected_version = 3
            new_status = "verified"
            reason = "Candidate metadata verified"
            mark_requirement_received = $true
            expected_requirement_version = 1
        }
        idempotency_key = "uok-shipment-instance-verified-$Stamp"
    }
    $verified = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body $verifyBody
    if (
        $verified.result.status -ne "verified" -or
        $verified.result.version -ne 4 -or
        $verified.result.requirement.status -ne "received" -or
        $verified.result.requirement.version -ne 2
    ) {
        throw "Shipment document-instance verification is invalid: $($verified | ConvertTo-Json -Depth 20)"
    }

    $satisfied = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements" `
        -Headers $ViewerHeaders
    if (
        $satisfied.summary.required_total -ne 2 -or
        $satisfied.summary.required_satisfied -ne 2 -or
        $satisfied.summary.required_missing -ne 0 -or
        $satisfied.summary.required_received -ne 2
    ) {
        throw "Verified metadata did not update Shipment readiness: $($satisfied | ConvertTo-Json -Depth 20)"
    }

    $listResponse = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-instances" `
        -Headers $ViewerHeaders
    $instances = @($listResponse | ForEach-Object { $_ })
    $detail = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-instances/$instanceId" `
        -Headers $ViewerHeaders
    $historyResponse = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-instances/$instanceId/history" `
        -Headers $ViewerHeaders
    $history = @($historyResponse | ForEach-Object { $_ })
    $requirementHistoryResponse = Invoke-UokJson `
        -Path "/api/shipments/records/$ShipmentId/document-requirements/$requirementId/history" `
        -Headers $ViewerHeaders
    $requirementHistory = @($requirementHistoryResponse | ForEach-Object { $_ })
    if (
        @($instances | Where-Object { $_.id -eq $instanceId }).Count -ne 1 -or
        $detail.status -ne "verified" -or
        $detail.requirement.status -ne "received" -or
        $history.Count -ne 4 -or
        $history[0].action -ne "status_changed" -or
        @($history | Where-Object { $_.action -eq "created" }).Count -ne 1 -or
        @($history | Where-Object { $_.action -eq "updated" }).Count -ne 1 -or
        @($history | Where-Object { $_.action -eq "status_changed" }).Count -ne 2 -or
        $requirementHistory.Count -ne 2 -or
        $requirementHistory[0].action -ne "status_changed"
    ) {
        throw "Shipment document-instance readback or history is invalid"
    }

    $replayed = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body $verifyBody
    $historyAfterReplay = @(
        Invoke-UokJson `
            -Path "/api/shipments/records/$ShipmentId/document-instances/$instanceId/history" `
            -Headers $ViewerHeaders |
            ForEach-Object { $_ }
    )
    $requirementHistoryAfterReplay = @(
        Invoke-UokJson `
            -Path "/api/shipments/records/$ShipmentId/document-requirements/$requirementId/history" `
            -Headers $ViewerHeaders |
            ForEach-Object { $_ }
    )
    if (
        -not $replayed.idempotent -or
        $replayed.result.correlation_id -ne $verified.command_id -or
        $replayed.result.version -ne 4 -or
        $replayed.result.requirement.version -ne 2 -or
        $historyAfterReplay.Count -ne 4 -or
        $requirementHistoryAfterReplay.Count -ne 2
    ) {
        throw "Shipment document-instance verification replay was not idempotent"
    }

    $shipment = Invoke-UokJson -Path "/api/shipments/records/$ShipmentId" -Headers $ViewerHeaders
    if ($shipment.version -ne 2) {
        throw "Shipment document-instance operations changed the Shipment header version"
    }
    return @{
        instance_id = $instanceId
        requirement_id = $requirementId
    }
}
