function Invoke-UokShipmentReadinessCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson `
        -Method "POST" `
        -Path "/api/modules/intelligence.core/install" `
        -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Shipment Readiness install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    $shipmentCode = "RCN-AFRICA-VOC-$Stamp"
    $initialResponse = Invoke-UokJson `
        -Path "/api/intelligence/shipment-readiness" `
        -Headers $ViewerHeaders
    if (
        $initialResponse.source_status -ne "ready" -or
        -not $initialResponse.source_summary
    ) {
        throw "Shipment Readiness source response is invalid: $($initialResponse | ConvertTo-Json -Depth 20)"
    }
    $initialSignals = @($initialResponse.items | Where-Object { $_.code -eq $shipmentCode })
    if (
        $initialSignals.Count -ne 1 -or
        $initialSignals[0].band -ne "ready" -or
        $initialSignals[0].required_missing -ne 0 -or
        $initialSignals[0].document_instance_verified -lt 1
    ) {
        throw "Shipment Readiness did not derive the satisfied candidate: $($initialResponse | ConvertTo-Json -Depth 20)"
    }
    $shipmentId = $initialSignals[0].shipment_id
    $shipmentBefore = Invoke-UokJson `
        -Path "/api/shipments/records/$shipmentId" `
        -Headers $ViewerHeaders

    $optionsResponse = Invoke-UokJson `
        -Path "/api/shipments/document-type-options" `
        -Headers $ViewerHeaders
    $phytosanitaryOptions = @($optionsResponse | Where-Object {
        $_.code -eq "PHYTOSANITARY-CERTIFICATE-$Stamp" -and
        $_.status -eq "ready" -and
        $_.lifecycle_status -eq "active"
    })
    if ($phytosanitaryOptions.Count -ne 1) {
        throw "Shipment-owned document type options did not expose the active candidate type"
    }

    $added = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddShipmentDocumentRequirement"
        payload = @{
            shipment_id = $shipmentId
            compliance_document_type_id = $phytosanitaryOptions[0].compliance_document_type_id
            requirement_level = "required"
            notes = "Candidate proof for advisory readiness signals."
        }
        idempotency_key = "uok-intelligence-readiness-required-$Stamp"
    }
    if (
        -not $added.result.id -or
        $added.result.status -ne "missing" -or
        $added.result.version -ne 1
    ) {
        throw "Shipment requirement creation for readiness proof is invalid: $($added | ConvertTo-Json -Depth 20)"
    }
    $requirementId = $added.result.id

    $attentionResponse = Invoke-UokJson `
        -Path "/api/intelligence/shipment-readiness" `
        -Headers $ViewerHeaders
    $attentionSignals = @($attentionResponse.items | Where-Object { $_.shipment_id -eq $shipmentId })
    if (
        $attentionSignals.Count -ne 1 -or
        $attentionSignals[0].band -ne "attention_required" -or
        $attentionSignals[0].required_missing -ne 1 -or
        "required_documents_missing" -notin @($attentionSignals[0].reason_codes)
    ) {
        throw "Shipment Readiness did not expose the missing required document: $($attentionResponse | ConvertTo-Json -Depth 20)"
    }

    $received = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "SetShipmentDocumentRequirementStatus"
        payload = @{
            shipment_id = $shipmentId
            requirement_id = $requirementId
            expected_version = 1
            new_status = "received"
            reason = "Candidate readiness satisfaction proof"
        }
        idempotency_key = "uok-intelligence-readiness-received-$Stamp"
    }
    if (
        $received.result.status -ne "received" -or
        $received.result.version -ne 2
    ) {
        throw "Shipment requirement satisfaction for readiness proof is invalid"
    }

    $readyResponse = Invoke-UokJson `
        -Path "/api/intelligence/shipment-readiness" `
        -Headers $ViewerHeaders
    $readySignals = @($readyResponse.items | Where-Object { $_.shipment_id -eq $shipmentId })
    if (
        $readySignals.Count -ne 1 -or
        $readySignals[0].band -ne "ready" -or
        $readySignals[0].required_missing -ne 0 -or
        $readySignals[0].required_satisfied -ne $readySignals[0].required_total -or
        "required_documents_satisfied" -notin @($readySignals[0].reason_codes)
    ) {
        throw "Shipment Readiness did not return to ready: $($readyResponse | ConvertTo-Json -Depth 20)"
    }

    $shipmentAfter = Invoke-UokJson `
        -Path "/api/shipments/records/$shipmentId" `
        -Headers $ViewerHeaders
    if (
        $shipmentAfter.status -ne $shipmentBefore.status -or
        $shipmentAfter.version -ne $shipmentBefore.version
    ) {
        throw "Advisory readiness operations changed the Shipment header lifecycle"
    }

    Invoke-UokWithModuleDisabled -ModuleName "intelligence.core" -Headers $Headers -Action {
        Assert-UokHttpFailure `
            -StatusCode 400 `
            -UnexpectedSuccessMessage "Disabled Shipment Readiness module served signals" `
            -Action {
                Invoke-UokJson `
                    -Path "/api/intelligence/shipment-readiness" `
                    -Headers $ViewerHeaders
            }
    }

    return @{
        shipment_id = $shipmentId
        requirement_id = $requirementId
        initial_band = $initialSignals[0].band
        attention_band = $attentionSignals[0].band
        final_band = $readySignals[0].band
        header_status = $shipmentAfter.status
        header_version = $shipmentAfter.version
    }
}
