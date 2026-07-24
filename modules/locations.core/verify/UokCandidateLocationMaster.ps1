function Invoke-UokLocationMasterCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/locations.core/install" -Headers $Headers
    if ($installed.status -notin @("installed", "upgraded")) {
        throw "Location Master install failed: $($installed | ConvertTo-Json -Depth 20)"
    }
    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateLocationDefinition"
        payload = @{
            code = "NG-APAPA-CANDIDATE-$Stamp"
            canonical_name = "Candidate Apapa Port $Stamp"
            location_type = "port"
            country_code = "NG"
        }
        idempotency_key = "uok-location-create-$Stamp"
    }
    if (-not $created.result.id -or $created.result.correlation_id -ne $created.command_id -or $created.result.version -ne 1) {
        throw "Location creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $locationId = $created.result.id
    $detail = Invoke-UokJson -Path "/api/locations/definitions/$locationId" -Headers $ViewerHeaders
    if ($detail.id -ne $locationId -or $detail.code -ne "NG-APAPA-CANDIDATE-$Stamp") {
        throw "Location detail readback failed: $($detail | ConvertTo-Json -Depth 20)"
    }
    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateLocationDefinition"
        payload = @{
            location_definition_id = $locationId
            expected_version = 1
            canonical_name = "Candidate Port of Apapa $Stamp"
            reason = "Candidate canonical-name verification"
        }
        idempotency_key = "uok-location-update-$Stamp"
    }
    if ($updated.result.version -ne 2 -or $updated.result.canonical_name -ne "Candidate Port of Apapa $Stamp") {
        throw "Location update is invalid: $($updated | ConvertTo-Json -Depth 20)"
    }
    $history = @(Invoke-UokJson -Path "/api/locations/definitions/$locationId/name-history" -Headers $ViewerHeaders)
    if ($history.Count -ne 1 -or $history[0].previous_name -ne "Candidate Apapa Port $Stamp") {
        throw "Location name history is invalid: $($history | ConvertTo-Json -Depth 20)"
    }
    $archived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ArchiveLocationDefinition"
        payload = @{ location_definition_id = $locationId; expected_version = 2 }
        idempotency_key = "uok-location-archive-$Stamp"
    }
    if ($archived.result.status -ne "archived" -or $archived.result.version -ne 3) {
        throw "Location archive is invalid: $($archived | ConvertTo-Json -Depth 20)"
    }
    $activeRows = @(Invoke-UokJson -Path "/api/locations/definitions" -Headers $ViewerHeaders)
    if (@($activeRows | Where-Object { $_.id -eq $locationId }).Count -ne 0) {
        throw "Archived Location leaked into the default list"
    }
    $allRows = @(Invoke-UokJson -Path "/api/locations/definitions?include_archived=true" -Headers $ViewerHeaders)
    if (@($allRows | Where-Object { $_.id -eq $locationId -and $_.status -eq "archived" }).Count -ne 1) {
        throw "Archived Location was not available through the explicit filter"
    }
    $restored = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RestoreLocationDefinition"
        payload = @{ location_definition_id = $locationId; expected_version = 3 }
        idempotency_key = "uok-location-restore-$Stamp"
    }
    if ($restored.result.status -ne "active" -or $restored.result.version -ne 4) {
        throw "Location restore is invalid: $($restored | ConvertTo-Json -Depth 20)"
    }
    Invoke-UokWithModuleDisabled -ModuleName "locations.core" -Headers $Headers -Action {
        Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled Location Master unexpectedly served definitions" -Action {
            Invoke-UokJson -Path "/api/locations/definitions" -Headers $ViewerHeaders
        }
    }
    return @{ location_definition_id = $locationId }
}
