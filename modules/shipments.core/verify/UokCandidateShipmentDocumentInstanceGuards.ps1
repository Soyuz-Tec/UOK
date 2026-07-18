function Get-UokShipmentDocumentInstanceReferenceFailure {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][string]$ShipmentId,
        [Parameter(Mandatory = $true)][string]$DocumentTypeId,
        [string]$RequirementId = "",
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $payload = @{
        shipment_id = $ShipmentId
        compliance_document_type_id = $DocumentTypeId
        document_number = "REJECTED-$Key-$Stamp"
    }
    if ($RequirementId) {
        $payload.requirement_id = $RequirementId
    }
    return Get-UokHttpFailureBody `
        -StatusCode 400 `
        -UnexpectedSuccessMessage "Shipment document instance unexpectedly accepted $Key reference" `
        -Action {
            Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
                command_type = "CreateShipmentDocumentInstance"
                payload = $payload
                idempotency_key = "uok-shipment-instance-reject-$Key-$Stamp"
            }
        }
}

function Assert-UokShipmentDocumentInstanceGuards {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][string]$ShipmentId,
        [Parameter(Mandatory = $true)][pscustomobject]$DocumentTypes,
        [Parameter(Mandatory = $true)][string]$RequirementId,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    Assert-UokHttpFailure `
        -StatusCode 403 `
        -UnexpectedSuccessMessage "Viewer unexpectedly created Shipment document-instance metadata" `
        -Action {
            Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
                command_type = "CreateShipmentDocumentInstance"
                payload = @{
                    shipment_id = $ShipmentId
                    compliance_document_type_id = $DocumentTypes.commercial_invoice_id
                    requirement_id = $RequirementId
                    document_number = "VIEWER-$Stamp"
                }
                idempotency_key = "uok-shipment-instance-viewer-create-$Stamp"
            }
        }

    Assert-UokHttpFailure `
        -StatusCode 400 `
        -UnexpectedSuccessMessage "Shipment document instance accepted a storage key" `
        -Action {
            Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
                command_type = "CreateShipmentDocumentInstance"
                payload = @{
                    shipment_id = $ShipmentId
                    compliance_document_type_id = $DocumentTypes.commercial_invoice_id
                    requirement_id = $RequirementId
                    document_number = "STORAGE-KEY-$Stamp"
                    storage_key = "forbidden/$Stamp.pdf"
                }
                idempotency_key = "uok-shipment-instance-storage-key-$Stamp"
            }
        }

    foreach ($rejected in @(
        @{
            type_id = $DocumentTypes.certificate_of_origin_id
            requirement_id = ""
            key = "inactive"
        },
        @{
            type_id = "00000000-0000-0000-0000-000000000000"
            requirement_id = ""
            key = "unknown"
        },
        @{
            type_id = $DocumentTypes.bill_of_lading_id
            requirement_id = $RequirementId
            key = "mismatched"
        }
    )) {
        $failure = Get-UokShipmentDocumentInstanceReferenceFailure `
            -OpsHeaders $OpsHeaders `
            -ShipmentId $ShipmentId `
            -DocumentTypeId $rejected.type_id `
            -RequirementId $rejected.requirement_id `
            -Key $rejected.key `
            -Stamp $Stamp
        $failureText = $failure | ConvertTo-Json -Depth 20 -Compress
        if (
            $failureText.Contains([string]$rejected.type_id) -or
            ($rejected.requirement_id -and $failureText.Contains([string]$rejected.requirement_id))
        ) {
            throw "Shipment document-instance $($rejected.key) failure exposed a rejected identifier"
        }
    }
}
