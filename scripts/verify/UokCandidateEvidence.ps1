function Assert-UokCandidateEvidence {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][string]$ContactId,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $detail = Invoke-UokJson -Path "/api/contacts/$ContactId" -Headers $Headers
    if (-not $detail.notes -or -not $detail.relationships) {
        throw "Contact detail evidence failed: $($detail | ConvertTo-Json -Depth 20)"
    }

    $reviewQueue = Invoke-UokJson -Path "/api/contacts/review-queue" -Headers $Headers
    if (-not $reviewQueue -or -not ($reviewQueue | Where-Object { $_.source -eq "csv_import" })) {
        throw "Review queue evidence failed: $($reviewQueue | ConvertTo-Json -Depth 20)"
    }

    $contactSearch = Invoke-UokJson -Path "/api/contacts?query=UOK%20Contact%20$Stamp" -Headers $Headers
    if (-not ($contactSearch | Where-Object { $_.id -eq $ContactId })) {
        throw "Contact search failed: $($contactSearch | ConvertTo-Json -Depth 20)"
    }

    $upgraded = Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/upgrade" -Headers $Headers
    if ($upgraded.status -ne "upgraded") {
        throw "Contacts upgrade failed: $($upgraded | ConvertTo-Json -Depth 20)"
    }

    $uninstalled = Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/uninstall" -Headers $Headers
    if ($uninstalled.status -ne "uninstalled") {
        throw "Contacts uninstall failed: $($uninstalled | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Contact read unexpectedly succeeded after uninstall" -Action {
        Invoke-UokJson -Path "/api/contacts/$ContactId" -Headers $Headers
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Contact command unexpectedly succeeded after uninstall" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreateContact"
            payload = @{ display_name = "Blocked Contact $Stamp"; company_name = "Blocked Account" }
            idempotency_key = "uok-blocked-contact-$Stamp"
        }
    }

    $reinstalled = Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/install" -Headers $Headers
    if ($reinstalled.status -ne "installed") {
        throw "Contacts reinstall failed: $($reinstalled | ConvertTo-Json -Depth 20)"
    }

    $lifecycle = Invoke-UokJson -Path "/api/modules/lifecycle" -Headers $Headers
    $evidence = Invoke-UokJson -Path "/api/baseline-evidence" -Headers $Headers
    $migration = Invoke-UokJson -Path "/api/migrations/discipline" -Headers $Headers
    $verify = Invoke-UokJson -Method "POST" -Path "/api/architecture/verify-baseline" -Headers $Headers
    $ui = Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing
    $forbiddenCombinedLabel = "Product" + " Cargo"
    $forbiddenSpecificCargoName = "Bo" + "nny"
    $forbiddenRetiredUokName = -join ([char[]](67,108,101,97,110,45,82,111,111,109,32,75,101,114,110,101,108))

    if (-not $lifecycle.ok -or -not $lifecycle.checks.apps_manager_declared -or -not $lifecycle.checks.contacts_declared_as_available_module -or -not $lifecycle.checks.only_apps_manager_required) {
        throw "Module lifecycle failed: $($lifecycle | ConvertTo-Json -Depth 30)"
    }
    if (
        -not $evidence.ok `
        -or -not $evidence.checks.apps_manager_operational `
        -or -not $evidence.checks.contacts_module_operational `
        -or -not $evidence.checks.contact_full_crm_events_present `
        -or -not $evidence.checks.private_notes_available `
        -or -not $evidence.checks.relationships_available `
        -or -not $evidence.checks.import_batches_available `
        -or -not $evidence.checks.review_queue_available
    ) {
        throw "Baseline evidence failed: $($evidence | ConvertTo-Json -Depth 30)"
    }
    if (
        -not $migration.ok `
        -or -not $migration.checks.single_active_baseline `
        -or -not $migration.checks.baseline_has_no_business_module_tables `
        -or -not $migration.checks.module_migration_directories_present `
        -or -not $migration.checks.module_migration_files_scoped `
        -or -not $migration.checks.contacts_core_module_migration_present
    ) {
        throw "Migration discipline failed: $($migration | ConvertTo-Json -Depth 30)"
    }
    if (-not $verify.result.ok -or -not $verify.result.checks.module_neutral_baseline -or -not $verify.result.checks.module_lifecycle_ok) {
        throw "Baseline verifier failed: $($verify | ConvertTo-Json -Depth 30)"
    }
    if ($ui.Content -notmatch "UOK" -or $ui.Content -match $forbiddenRetiredUokName -or $ui.Content -notmatch "Apps Manager" -or $ui.Content -notmatch "Contacts" -or $ui.Content -match $forbiddenSpecificCargoName -or $ui.Content -match $forbiddenCombinedLabel) {
        throw "UI marker check failed"
    }
}
