function Invoke-UokComplianceDocumentTypeCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson `
        -Method "POST" `
        -Path "/api/modules/compliance.core/install" `
        -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Compliance Document Type install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateComplianceDocumentType"
        payload = @{
            code = "PHYTOSANITARY-CERTIFICATE-$Stamp"
            canonical_name = "Candidate Phytosanitary Certificate $Stamp"
            description = "Tenant-reviewed RCN workflow vocabulary."
            category = "Sanitary"
        }
        idempotency_key = "uok-compliance-document-type-create-$Stamp"
    }
    if (
        -not $created.result.id -or
        $created.result.status -ne "active" -or
        $created.result.version -ne 1 -or
        $created.result.correlation_id -ne $created.command_id
    ) {
        throw "Compliance Document Type creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $documentTypeId = $created.result.id

    $detail = Invoke-UokJson `
        -Path "/api/compliance/document-types/$documentTypeId" `
        -Headers $ViewerHeaders
    if (
        $detail.id -ne $documentTypeId -or
        $detail.code -ne "PHYTOSANITARY-CERTIFICATE-$Stamp" -or
        $detail.category -ne "Sanitary"
    ) {
        throw "Compliance Document Type detail readback failed: $($detail | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure `
        -StatusCode 403 `
        -UnexpectedSuccessMessage "Viewer unexpectedly updated a Compliance Document Type" `
        -Action {
            Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
                command_type = "UpdateComplianceDocumentType"
                payload = @{
                    compliance_document_type_id = $documentTypeId
                    expected_version = 1
                    description = "Unauthorized candidate update."
                    reason = "Candidate authorization verification"
                }
                idempotency_key = "uok-compliance-document-type-viewer-update-$Stamp"
            }
        }

    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $documentTypeId
            expected_version = 1
            canonical_name = "Candidate RCN Phytosanitary Certificate $Stamp"
            description = "Tenant-reviewed certificate vocabulary for candidate verification."
            category = "Sanitary"
            reason = "Candidate canonical-name verification"
        }
        idempotency_key = "uok-compliance-document-type-update-$Stamp"
    }
    if (
        $updated.result.version -ne 2 -or
        $updated.result.canonical_name -ne "Candidate RCN Phytosanitary Certificate $Stamp"
    ) {
        throw "Compliance Document Type update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }

    $historyResponse = Invoke-UokJson `
        -Path "/api/compliance/document-types/$documentTypeId/name-history" `
        -Headers $ViewerHeaders
    $history = @($historyResponse | ForEach-Object { $_ })
    if (
        $history.Count -ne 1 -or
        $history[0].previous_name -ne "Candidate Phytosanitary Certificate $Stamp" -or
        $history[0].new_name -ne "Candidate RCN Phytosanitary Certificate $Stamp"
    ) {
        throw "Compliance Document Type name history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }

    $searchResponse = Invoke-UokJson `
        -Path "/api/compliance/document-types?search=RCN%20Phytosanitary&category=Sanitary&status=active" `
        -Headers $ViewerHeaders
    $searchRows = @($searchResponse | ForEach-Object { $_ })
    if (@($searchRows | Where-Object {
        $_.id -eq $documentTypeId -and $_.status -eq "active"
    }).Count -ne 1) {
        throw "Compliance Document Type search/category/status filters are invalid"
    }

    $deactivated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "DeactivateComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $documentTypeId
            expected_version = 2
            reason = "Candidate inactive-state verification"
        }
        idempotency_key = "uok-compliance-document-type-deactivate-$Stamp"
    }
    if ($deactivated.result.status -ne "inactive" -or $deactivated.result.version -ne 3) {
        throw "Compliance Document Type deactivation is invalid: $($deactivated | ConvertTo-Json -Depth 20)"
    }

    $inactiveResponse = Invoke-UokJson `
        -Path "/api/compliance/document-types?status=inactive" `
        -Headers $ViewerHeaders
    $inactiveRows = @($inactiveResponse | ForEach-Object { $_ })
    if (@($inactiveRows | Where-Object { $_.id -eq $documentTypeId }).Count -ne 1) {
        throw "Inactive Compliance Document Type was not available through the status filter"
    }

    $activated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ActivateComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $documentTypeId
            expected_version = 3
            reason = "Candidate reactivation verification"
        }
        idempotency_key = "uok-compliance-document-type-activate-$Stamp"
    }
    if ($activated.result.status -ne "active" -or $activated.result.version -ne 4) {
        throw "Compliance Document Type activation is invalid: $($activated | ConvertTo-Json -Depth 20)"
    }

    $archived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ArchiveComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $documentTypeId
            expected_version = 4
            reason = "Candidate archive verification"
        }
        idempotency_key = "uok-compliance-document-type-archive-$Stamp"
    }
    if ($archived.result.status -ne "archived" -or $archived.result.version -ne 5) {
        throw "Compliance Document Type archive is invalid: $($archived | ConvertTo-Json -Depth 20)"
    }

    $defaultResponse = Invoke-UokJson `
        -Path "/api/compliance/document-types" `
        -Headers $ViewerHeaders
    $defaultRows = @($defaultResponse | ForEach-Object { $_ })
    if (@($defaultRows | Where-Object { $_.id -eq $documentTypeId }).Count -ne 0) {
        throw "Archived Compliance Document Type leaked into the default list"
    }
    $archivedResponse = Invoke-UokJson `
        -Path "/api/compliance/document-types?include_archived=true&status=archived" `
        -Headers $ViewerHeaders
    $archivedRows = @($archivedResponse | ForEach-Object { $_ })
    if (@($archivedRows | Where-Object {
        $_.id -eq $documentTypeId -and $_.status -eq "archived"
    }).Count -ne 1) {
        throw "Archived Compliance Document Type was not available through explicit filters"
    }

    $restored = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RestoreComplianceDocumentType"
        payload = @{
            compliance_document_type_id = $documentTypeId
            expected_version = 5
            reason = "Candidate restore verification"
        }
        idempotency_key = "uok-compliance-document-type-restore-$Stamp"
    }
    if ($restored.result.status -ne "active" -or $restored.result.version -ne 6) {
        throw "Compliance Document Type restore is invalid: $($restored | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokWithModuleDisabled -ModuleName "compliance.core" -Headers $Headers -Action {
        Assert-UokHttpFailure `
            -StatusCode 400 `
            -UnexpectedSuccessMessage "Disabled Compliance Document Type registry served definitions" `
            -Action {
                Invoke-UokJson -Path "/api/compliance/document-types" -Headers $ViewerHeaders
            }
    }
    return @{ compliance_document_type_id = $documentTypeId }
}
