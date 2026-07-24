. (Join-Path $PSScriptRoot "UokCandidateContacts.Support.ps1")
. (Join-Path $PSScriptRoot "UokCandidateContacts.Evidence.ps1")

function Invoke-UokContactsCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/install" -Headers $Headers
    if ($installed.status -ne "installed") {
        throw "Contacts install failed: $($installed | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Invalid contact unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreateContact"
            payload = @{}
            idempotency_key = "uok-invalid-contact-$Stamp"
        }
    }

    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer contact creation unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
            command_type = "CreateContact"
            payload = @{ display_name = "Denied Contact $Stamp"; company_name = "Denied Account" }
            idempotency_key = "uok-denied-contact-$Stamp"
        }
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Oversized contact note unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
            command_type = "CreateContact"
            payload = @{ display_name = "Oversized Contact $Stamp"; note = "n" * 4001 }
            idempotency_key = "uok-oversized-note-$Stamp"
        }
    }

    $contact = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{
            display_name = "UOK Contact $Stamp"
            email = "contact-$Stamp@example.test"
            company_name = "UOK Account $Stamp"
        }
        idempotency_key = "uok-contact-$Stamp"
    }
    if (-not $contact.result.contact_id) {
        throw "Contact creation failed: $($contact | ConvertTo-Json -Depth 20)"
    }
    $contactId = $contact.result.contact_id
    $companyId = $contact.result.company_party_id

    $contactReplay = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{
            display_name = "UOK Contact $Stamp"
            email = "contact-$Stamp@example.test"
            company_name = "UOK Account $Stamp"
        }
        idempotency_key = "uok-contact-$Stamp"
    }
    if (-not $contactReplay.idempotent) {
        throw "Idempotent replay failed: $($contactReplay | ConvertTo-Json -Depth 20)"
    }

    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer idempotency replay unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $ViewerHeaders -Body @{
            command_type = "CreateContact"
            payload = @{
                display_name = "UOK Contact $Stamp"
                email = "contact-$Stamp@example.test"
                company_name = "UOK Account $Stamp"
            }
            idempotency_key = "uok-contact-$Stamp"
        }
    }

    $updated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateContact"
        payload = @{
            party_id = $contactId
            phone = "+1 555 0100"
            website = "https://example.test"
            note = "Updated during UOK Contacts alpha.3 verification."
        }
        idempotency_key = "uok-update-contact-$Stamp"
    }
    if ($updated.result.phone -ne "+1 555 0100") {
        throw "Contact update failed: $($updated | ConvertTo-Json -Depth 20)"
    }

    $note = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddContactNote"
        payload = @{ party_id = $contactId; body = "Private internal note for candidate verification." }
        idempotency_key = "uok-note-contact-$Stamp"
    }
    if (-not $note.result.note_id) {
        throw "Contact note failed: $($note | ConvertTo-Json -Depth 20)"
    }

    $linked = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "LinkContactRelationship"
        payload = @{ from_party_id = $contactId; to_party_id = $companyId; relationship_type = "primary_contact" }
        idempotency_key = "uok-link-contact-$Stamp"
    }
    if (-not $linked.result.relationship_id) {
        throw "Contact relationship failed: $($linked | ConvertTo-Json -Depth 20)"
    }
    $relationshipId = $linked.result.relationship_id

    $relationshipUpdated = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "UpdateContactRelationship"
        payload = @{ relationship_id = $relationshipId; from_party_id = $contactId; to_party_id = $companyId; relationship_type = "billing_contact" }
        idempotency_key = "uok-update-relationship-$Stamp"
    }
    if ($relationshipUpdated.result.updated_count -lt 1) {
        throw "Contact relationship update failed: $($relationshipUpdated | ConvertTo-Json -Depth 20)"
    }

    $relationshipRemoved = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RemoveContactRelationship"
        payload = @{ relationship_id = $relationshipId }
        idempotency_key = "uok-remove-relationship-$Stamp"
    }
    if ($relationshipRemoved.result.removed_count -lt 1) {
        throw "Contact relationship unlink failed: $($relationshipRemoved | ConvertTo-Json -Depth 20)"
    }

    $relinked = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "LinkContactRelationship"
        payload = @{ from_party_id = $contactId; to_party_id = $companyId; relationship_type = "primary_contact" }
        idempotency_key = "uok-relink-contact-$Stamp"
    }
    if (-not $relinked.result.relationship_id) {
        throw "Contact relationship relink failed: $($relinked | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokContactsCandidateGroupScenario -OpsHeaders $OpsHeaders -ContactId $contactId -Stamp $Stamp

    $archived = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "ArchiveContact"
        payload = @{ party_id = $contactId }
        idempotency_key = "uok-archive-contact-$Stamp"
    }
    if ($archived.result.status -ne "archived") {
        throw "Contact archive failed: $($archived | ConvertTo-Json -Depth 20)"
    }

    $restored = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RestoreContact"
        payload = @{ party_id = $contactId }
        idempotency_key = "uok-restore-contact-$Stamp"
    }
    if ($restored.result.status -ne "active") {
        throw "Contact restore failed: $($restored | ConvertTo-Json -Depth 20)"
    }

    $stampText = [string]$Stamp
    $phoneDigits = $stampText.Substring([Math]::Max(0, $stampText.Length - 10)).PadLeft(10, "0")
    $imported = Invoke-UokJson -Method "POST" -Path "/api/contacts/import-csv" -Headers $OpsHeaders -Body @{
        filename = "contacts-alpha3-$Stamp.csv"
        csv_text = "display_name,email,company,phone`nImported Contact $Stamp,imported-$Stamp@example.test,Imported Account $Stamp,+1$phoneDigits`n"
        mode = "create"
    }
    if ($imported.imported_count -lt 1) {
        throw "Contact CSV import failed: $($imported | ConvertTo-Json -Depth 20)"
    }

    $scenario = @{ contact_id = $contactId }
    Assert-UokCandidateEvidence `
        -Headers $Headers `
        -OpsHeaders $OpsHeaders `
        -ViewerHeaders $ViewerHeaders `
        -Scenario $scenario `
        -Stamp $Stamp
    return $scenario
}
