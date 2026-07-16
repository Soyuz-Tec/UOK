function Invoke-UokCommunicationsCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/install" -Headers $Headers
    if ($installed.status -ne "installed") {
        throw "Communications install failed: $($installed | ConvertTo-Json -Depth 20)"
    }
    $created = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateCommunicationThread"
        payload = @{
            title = "Candidate K Connect room $Stamp"
            context_type = "planning.task"
            context_id = "candidate-task-$Stamp"
        }
        idempotency_key = "uok-communication-thread-$Stamp"
    }
    if (-not $created.result.id -or $created.result.correlation_id -ne $created.command_id) {
        throw "Communication thread creation is invalid: $($created | ConvertTo-Json -Depth 20)"
    }
    $threadId = $created.result.id
    if (-not $created.result.etag -or $created.result.status -ne "open") {
        throw "Communication thread did not expose its initial lifecycle validator: $($created | ConvertTo-Json -Depth 20)"
    }
    $viewer = Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $ViewerHeaders
    if ($viewer.id -ne $threadId -or $viewer.title -ne "Candidate K Connect room $Stamp") {
        throw "Viewer did not read the exact K Connect thread: $($viewer | ConvertTo-Json -Depth 20)"
    }
    $financeHeaders = New-UokAuthHeaders -Username "finance" -Password "finance123"
    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Finance communication read unexpectedly succeeded" -Action {
        Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $financeHeaders
    }

    $viewerDeleteHeaders = @{}
    foreach ($key in $ViewerHeaders.Keys) { $viewerDeleteHeaders[$key] = $ViewerHeaders[$key] }
    $viewerDeleteHeaders["If-Match"] = $created.result.etag
    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer communication deletion unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "DELETE" -Path "/api/communications/threads/$threadId" -Headers $viewerDeleteHeaders
    }

    $deleteHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $deleteHeaders[$key] = $OpsHeaders[$key] }
    $deleteHeaders["If-Match"] = $created.result.etag
    $archived = Invoke-UokJson -Method "DELETE" -Path "/api/communications/threads/$threadId" -Headers $deleteHeaders
    if ($archived.id -ne $threadId -or $archived.status -ne "archived" -or $archived.restore_status -ne "open" -or -not $archived.etag) {
        throw "Communication thread recoverable Delete is invalid: $($archived | ConvertTo-Json -Depth 20)"
    }
    Assert-UokHttpFailure -StatusCode 404 -UnexpectedSuccessMessage "Archived communication thread leaked through the default exact read" -Action {
        Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $OpsHeaders
    }
    $archivedRows = @(Invoke-UokJson -Path "/api/communications/threads?lifecycle=archived" -Headers $OpsHeaders)
    if (@($archivedRows | Where-Object { $_.id -eq $threadId }).Count -ne 1) {
        throw "Archived communication thread is not discoverable exactly once: $($archivedRows | ConvertTo-Json -Depth 20)"
    }
    $archivedExact = Invoke-UokJson -Path "/api/communications/threads/$threadId`?include_archived=true" -Headers $OpsHeaders
    if ($archivedExact.etag -ne $archived.etag) {
        throw "Archived lifecycle validator does not match an exact reload: $($archivedExact | ConvertTo-Json -Depth 20)"
    }

    $restoreHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $restoreHeaders[$key] = $OpsHeaders[$key] }
    $restoreHeaders["If-Match"] = $archived.etag
    $restored = Invoke-UokJson -Method "POST" -Path "/api/communications/threads/$threadId/restore" -Headers $restoreHeaders
    if ($restored.id -ne $threadId -or $restored.status -ne "open" -or $restored.restore_status -ne $null -or -not $restored.etag) {
        throw "Communication thread Restore is invalid: $($restored | ConvertTo-Json -Depth 20)"
    }
    $restoredExact = Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $OpsHeaders
    if ($restoredExact.etag -ne $restored.etag) {
        throw "Restored lifecycle validator does not match an exact reload: $($restoredExact | ConvertTo-Json -Depth 20)"
    }

    $cleanupHeaders = @{}
    foreach ($key in $OpsHeaders.Keys) { $cleanupHeaders[$key] = $OpsHeaders[$key] }
    $cleanupHeaders["If-Match"] = $restored.etag
    $cleanup = Invoke-UokJson -Method "DELETE" -Path "/api/communications/threads/$threadId" -Headers $cleanupHeaders
    if ($cleanup.status -ne "archived" -or $cleanup.restore_status -ne "open" -or -not $cleanup.etag) {
        throw "Communication thread cleanup Delete is invalid: $($cleanup | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/disable" -Headers $Headers | Out-Null
    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled communication provider unexpectedly read threads" -Action {
        Invoke-UokJson -Path "/api/communications/threads" -Headers $OpsHeaders
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/enable" -Headers $Headers | Out-Null
    return @{ thread_id = $threadId; final_status = $cleanup.status }
}
