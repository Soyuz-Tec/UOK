function Invoke-UokProductMasterCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/product.master/install" -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Product Master install failed: $($installed | ConvertTo-Json -Depth 20)"
    }
    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateProductDefinition"
        payload = @{
            code = "RCN-CANDIDATE-$Stamp"
            canonical_name = "Candidate Raw Cashew Nut $Stamp"
            category = "Commodity"
            grade = "Supplier Grade A"
            specification = "Contract specification"
            base_unit_code = "KG"
        }
        idempotency_key = "uok-product-create-$Stamp"
    }
    if (-not $created.result.id -or $created.result.correlation_id -ne $created.command_id -or $created.result.version -ne 1) {
        throw "Product creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $productId = $created.result.id
    $detail = Invoke-UokJson -Path "/api/products/definitions/$productId" -Headers $ViewerHeaders
    if ($detail.id -ne $productId -or $detail.code -ne "RCN-CANDIDATE-$Stamp") {
        throw "Product detail readback failed: $($detail | ConvertTo-Json -Depth 20)"
    }
    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateProductDefinition"
        payload = @{
            product_definition_id = $productId
            expected_version = 1
            canonical_name = "Candidate RCN $Stamp"
            reason = "Candidate canonical-name verification"
        }
        idempotency_key = "uok-product-update-$Stamp"
    }
    if ($updated.result.version -ne 2 -or $updated.result.canonical_name -ne "Candidate RCN $Stamp") {
        throw "Product update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }
    $history = @(Invoke-UokJson -Path "/api/products/definitions/$productId/name-history" -Headers $ViewerHeaders)
    if ($history.Count -ne 1 -or $history[0].previous_name -ne "Candidate Raw Cashew Nut $Stamp") {
        throw "Product name history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }
    $archived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ArchiveProductDefinition"
        payload = @{ product_definition_id = $productId; expected_version = 2 }
        idempotency_key = "uok-product-archive-$Stamp"
    }
    if ($archived.result.status -ne "archived" -or $archived.result.version -ne 3) {
        throw "Product archive is invalid: $($archived | ConvertTo-Json -Depth 20)"
    }
    $activeRows = @(Invoke-UokJson -Path "/api/products/definitions" -Headers $ViewerHeaders)
    if (@($activeRows | Where-Object { $_.id -eq $productId }).Count -ne 0) {
        throw "Archived Product leaked into the default list"
    }
    $allRows = @(Invoke-UokJson -Path "/api/products/definitions?include_archived=true" -Headers $ViewerHeaders)
    if (@($allRows | Where-Object { $_.id -eq $productId -and $_.status -eq "archived" }).Count -ne 1) {
        throw "Archived Product was not available through the explicit filter"
    }
    $restored = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RestoreProductDefinition"
        payload = @{ product_definition_id = $productId; expected_version = 3 }
        idempotency_key = "uok-product-restore-$Stamp"
    }
    if ($restored.result.status -ne "active" -or $restored.result.version -ne 4) {
        throw "Product restore is invalid: $($restored | ConvertTo-Json -Depth 20)"
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/product.master/disable" -Headers $Headers | Out-Null
    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled Product Master unexpectedly served definitions" -Action {
        Invoke-UokJson -Path "/api/products/definitions" -Headers $ViewerHeaders
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/product.master/enable" -Headers $Headers | Out-Null
    return @{ product_definition_id = $productId }
}
