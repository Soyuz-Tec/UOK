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

    $currentGroupResponse = Invoke-UokJson -Method "GET" -Path "/api/contacts/groups?include_empty=true&include_archived=true" -Headers $OpsHeaders
    # Windows PowerShell 5.1 can retain a top-level JSON array as one pipeline
    # object. Re-pipe it before selecting the exact candidate-created group.
    $currentGroupRows = @($currentGroupResponse | ForEach-Object { $_ })
    $currentGroup = $currentGroupRows | Where-Object { $_.id -eq $groupId } | Select-Object -First 1
    if (-not $currentGroup -or -not $currentGroup.etag -or -not $currentGroup.can_delete) {
        throw "Contact group did not expose its governed Delete validator: $($currentGroupRows | ConvertTo-Json -Depth 20)"
    }

    $deleteHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $deleteHeaders[$key] = $OpsHeaders[$key] }
    $deleteHeaders["If-Match"] = $currentGroup.etag
    $archivedGroup = Invoke-UokJson -Method "DELETE" -Path "/api/contacts/groups/$groupId" -Headers $deleteHeaders
    if ($archivedGroup.status -ne "archived" -or -not $archivedGroup.etag -or -not $archivedGroup.can_restore) {
        throw "Contact group recoverable Delete failed: $($archivedGroup | ConvertTo-Json -Depth 20)"
    }

    $restoreHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $restoreHeaders[$key] = $OpsHeaders[$key] }
    $restoreHeaders["If-Match"] = $archivedGroup.etag
    $restoredGroup = Invoke-UokJson -Method "POST" -Path "/api/contacts/groups/$groupId/restore" -Headers $restoreHeaders
    if ($restoredGroup.status -ne "active" -or -not $restoredGroup.etag -or -not $restoredGroup.can_delete) {
        throw "Contact group Restore failed: $($restoredGroup | ConvertTo-Json -Depth 20)"
    }

    $cleanupHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $cleanupHeaders[$key] = $OpsHeaders[$key] }
    $cleanupHeaders["If-Match"] = $restoredGroup.etag
    $cleanupGroup = Invoke-UokJson -Method "DELETE" -Path "/api/contacts/groups/$groupId" -Headers $cleanupHeaders
    if ($cleanupGroup.status -ne "archived" -or -not $cleanupGroup.can_restore) {
        throw "Contact group cleanup failed: $($cleanupGroup | ConvertTo-Json -Depth 20)"
    }
}
