function Assert-UokShipmentReadinessEvaluationMetadata {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [Parameter(Mandatory = $true)][string]$ExpectedAsOf,
        [Parameter(Mandatory = $true)][string]$ExpectedThrough
    )

    if (
        $Response.source_status -ne "ready" -or
        -not $Response.source_summary -or
        $Response.as_of -ne $ExpectedAsOf -or
        $Response.evaluation_timezone -ne "UTC" -or
        $Response.expiring_soon_horizon_days -ne 30 -or
        $Response.expiring_soon_through -ne $ExpectedThrough
    ) {
        throw "Shipment Readiness evaluation metadata is invalid for ${ExpectedAsOf}: $($Response | ConvertTo-Json -Depth 20)"
    }
}

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
    $documentExpiryOn = "2026-10-21"
    $baselineAsOf = "2026-09-20"
    $baselineThrough = "2026-10-20"
    $boundaryAsOf = "2026-09-21"
    $expiredAsOf = "2026-10-22"
    $initialResponse = Invoke-UokJson `
        -Path "/api/intelligence/shipment-readiness?as_of=$baselineAsOf" `
        -Headers $ViewerHeaders
    Assert-UokShipmentReadinessEvaluationMetadata `
        -Response $initialResponse `
        -ExpectedAsOf $baselineAsOf `
        -ExpectedThrough $baselineThrough
    $initialSignals = @($initialResponse.items | Where-Object { $_.code -eq $shipmentCode })
    if (
        $initialSignals.Count -ne 1 -or
        $initialSignals[0].band -ne "ready" -or
        $initialSignals[0].required_missing -ne 0 -or
        $initialSignals[0].document_instance_verified -lt 1 -or
        $initialSignals[0].document_instance_expiry_evaluated -ne 1 -or
        $initialSignals[0].document_instance_expiry_not_recorded -ne 0 -or
        $initialSignals[0].document_instance_expired -ne 0 -or
        $initialSignals[0].document_instance_expiring_soon -ne 0 -or
        $initialSignals[0].next_document_expiry_on -ne $documentExpiryOn -or
        "expired_document_present" -in @($initialSignals[0].reason_codes) -or
        "expiring_document_present" -in @($initialSignals[0].reason_codes)
    ) {
        throw "Shipment Readiness did not derive the satisfied candidate: $($initialResponse | ConvertTo-Json -Depth 20)"
    }
    $shipmentId = $initialSignals[0].shipment_id
    $shipmentBefore = Invoke-UokJson `
        -Path "/api/shipments/records/$shipmentId" `
        -Headers $ViewerHeaders
    $instanceListBefore = @(
        Invoke-UokJson `
            -Path "/api/shipments/records/$shipmentId/document-instances" `
            -Headers $ViewerHeaders |
            Where-Object {
                $_.status -eq "verified" -and
                $_.expires_on -eq $documentExpiryOn
            }
    )
    if ($instanceListBefore.Count -ne 1) {
        throw "Shipment candidate does not expose one verified 2026-10-21 document instance"
    }
    $expiryInstanceBefore = $instanceListBefore[0]

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
        -Path "/api/intelligence/shipment-readiness?as_of=$baselineAsOf" `
        -Headers $ViewerHeaders
    Assert-UokShipmentReadinessEvaluationMetadata `
        -Response $attentionResponse `
        -ExpectedAsOf $baselineAsOf `
        -ExpectedThrough $baselineThrough
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
        -Path "/api/intelligence/shipment-readiness?as_of=$baselineAsOf" `
        -Headers $ViewerHeaders
    Assert-UokShipmentReadinessEvaluationMetadata `
        -Response $readyResponse `
        -ExpectedAsOf $baselineAsOf `
        -ExpectedThrough $baselineThrough
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

    $expiryWindows = @(
        @{ key = "boundary"; as_of = $boundaryAsOf; through = $documentExpiryOn; expired = 0; soon = 1; required = "expiring_document_present"; forbidden = "expired_document_present" },
        @{ key = "same_day"; as_of = $documentExpiryOn; through = "2026-11-20"; expired = 0; soon = 1; required = "expiring_document_present"; forbidden = "expired_document_present" },
        @{ key = "expired"; as_of = $expiredAsOf; through = "2026-11-21"; expired = 1; soon = 0; required = "expired_document_present"; forbidden = "expiring_document_present" }
    )
    $expiryProofs = @{}
    foreach ($window in $expiryWindows) {
        $response = Invoke-UokJson `
            -Path "/api/intelligence/shipment-readiness?as_of=$($window.as_of)" `
            -Headers $ViewerHeaders
        Assert-UokShipmentReadinessEvaluationMetadata `
            -Response $response `
            -ExpectedAsOf $window.as_of `
            -ExpectedThrough $window.through
        $signals = @($response.items | Where-Object { $_.shipment_id -eq $shipmentId })
        if (
            $signals.Count -ne 1 -or
            $signals[0].band -ne "attention_required" -or
            $signals[0].document_instance_expiry_evaluated -ne 1 -or
            $signals[0].document_instance_expiry_not_recorded -ne 0 -or
            $signals[0].document_instance_expired -ne $window.expired -or
            $signals[0].document_instance_expiring_soon -ne $window.soon -or
            $window.required -notin @($signals[0].reason_codes) -or
            $window.forbidden -in @($signals[0].reason_codes)
        ) {
            throw "Shipment Readiness expiry window '$($window.key)' is invalid: $($response | ConvertTo-Json -Depth 20)"
        }
        $expiryProofs[$window.key] = @{ response = $response; signal = $signals[0] }
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
    $expiryInstanceAfter = Invoke-UokJson `
        -Path "/api/shipments/records/$shipmentId/document-instances/$($expiryInstanceBefore.id)" `
        -Headers $ViewerHeaders
    if (
        $expiryInstanceAfter.status -ne $expiryInstanceBefore.status -or
        $expiryInstanceAfter.version -ne $expiryInstanceBefore.version -or
        $expiryInstanceAfter.expires_on -ne $expiryInstanceBefore.expires_on
    ) {
        throw "Read-only date evaluation changed the verified Shipment document instance"
    }

    Invoke-UokWithModuleDisabled -ModuleName "intelligence.core" -Headers $Headers -Action {
        Assert-UokHttpFailure `
            -StatusCode 400 `
            -UnexpectedSuccessMessage "Disabled Shipment Readiness module served signals" `
            -Action {
                Invoke-UokJson `
                    -Path "/api/intelligence/shipment-readiness?as_of=$expiredAsOf" `
                    -Headers $ViewerHeaders
            }
    }

    return @{
        shipment_id = $shipmentId
        requirement_id = $requirementId
        initial_band = $initialSignals[0].band
        attention_band = $attentionSignals[0].band
        final_band = $readySignals[0].band
        evaluation_timezone = $expiryProofs.expired.response.evaluation_timezone
        expiry_horizon_days = $expiryProofs.expired.response.expiring_soon_horizon_days
        expiry_on = $documentExpiryOn
        outside_horizon_as_of = $baselineAsOf
        exact_boundary_as_of = $boundaryAsOf
        same_day_as_of = $documentExpiryOn
        expired_as_of = $expiredAsOf
        boundary_band = $expiryProofs.boundary.signal.band
        same_day_band = $expiryProofs.same_day.signal.band
        expired_band = $expiryProofs.expired.signal.band
        document_instance_id = $expiryInstanceBefore.id
        document_instance_version = $expiryInstanceAfter.version
        header_status = $shipmentAfter.status
        header_version = $shipmentAfter.version
    }
}
