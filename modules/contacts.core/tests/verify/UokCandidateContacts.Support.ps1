function Invoke-UokContactsCandidateGroupScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][string]$ContactId,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $group = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContactGroup"
        payload = @{ name = "Operations Contacts $Stamp"; description = "Candidate verification contact group." }
        idempotency_key = "uok-contact-group-$Stamp"
    }
    if (-not $group.result.id) {
        throw "Contact group creation failed: $($group | ConvertTo-Json -Depth 20)"
    }
    $groupId = $group.result.id

    $grouped = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddContactsToGroup"
        payload = @{ group_id = $groupId; party_ids = @($ContactId) }
        idempotency_key = "uok-contact-group-add-$Stamp"
    }
    if ($grouped.result.added_count -lt 1) {
        throw "Contact group membership add failed: $($grouped | ConvertTo-Json -Depth 20)"
    }

    $groupRows = Invoke-UokJson -Method "GET" -Path "/api/contacts/groups" -Headers $OpsHeaders
    if (-not ($groupRows | Where-Object { $_.id -eq $groupId -and $_.member_count -ge 1 })) {
        throw "Contact group list did not include membership count: $($groupRows | ConvertTo-Json -Depth 20)"
    }

    $groupFilteredRows = Invoke-UokJson -Method "GET" -Path "/api/contacts?status=all&group_id=$groupId" -Headers $OpsHeaders
    if (-not ($groupFilteredRows | Where-Object { $_.id -eq $ContactId })) {
        throw "Contact group filter did not return grouped contact: $($groupFilteredRows | ConvertTo-Json -Depth 20)"
    }

    $ungrouped = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "RemoveContactFromGroup"
        payload = @{ group_id = $groupId; party_id = $ContactId }
        idempotency_key = "uok-contact-group-remove-$Stamp"
    }
    if ($ungrouped.result.removed_count -lt 1) {
        throw "Contact group membership remove failed: $($ungrouped | ConvertTo-Json -Depth 20)"
    }

    $regrouped = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "AddContactsToGroup"
        payload = @{ group_id = $groupId; party_ids = @($ContactId) }
        idempotency_key = "uok-contact-group-readd-$Stamp"
    }
    if ($regrouped.result.added_count -lt 1) {
        throw "Contact group membership re-add failed: $($regrouped | ConvertTo-Json -Depth 20)"
    }
}
