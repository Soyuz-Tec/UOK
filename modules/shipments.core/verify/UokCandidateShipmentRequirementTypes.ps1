function New-UokShipmentRequirementDocumentTypes {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $billOfLading = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateComplianceDocumentType"
        payload = @{
            code = "BILL-OF-LADING-$Stamp"
            canonical_name = "Candidate Bill of Lading $Stamp"
            description = "Shipment-owned requirement verification type."
            category = "Transport"
        }
        idempotency_key = "uok-shipment-document-type-bol-$Stamp"
    }
    $certificateOfOrigin = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateComplianceDocumentType"
        payload = @{
            code = "CERTIFICATE-OF-ORIGIN-$Stamp"
            canonical_name = "Candidate Certificate of Origin $Stamp"
            description = "Shipment-owned requirement verification type."
            category = "Origin"
        }
        idempotency_key = "uok-shipment-document-type-origin-$Stamp"
    }
    foreach ($created in @($billOfLading, $certificateOfOrigin)) {
        if (
            -not $created.result.id -or
            $created.result.status -ne "active" -or
            $created.result.version -ne 1 -or
            $created.result.correlation_id -ne $created.command_id
        ) {
            throw "Shipment requirement Compliance type creation is invalid: $($created | ConvertTo-Json -Depth 20)"
        }
    }
    return [pscustomobject]@{
        bill_of_lading_id = $billOfLading.result.id
        certificate_of_origin_id = $certificateOfOrigin.result.id
    }
}
