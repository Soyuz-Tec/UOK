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
    $viewer = Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $ViewerHeaders
    if ($viewer.id -ne $threadId -or $viewer.title -ne "Candidate K Connect room $Stamp") {
        throw "Viewer did not read the exact K Connect thread: $($viewer | ConvertTo-Json -Depth 20)"
    }
    $financeHeaders = New-UokAuthHeaders -Username "finance" -Password "finance123"
    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Finance communication read unexpectedly succeeded" -Action {
        Invoke-UokJson -Path "/api/communications/threads/$threadId" -Headers $financeHeaders
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/disable" -Headers $Headers | Out-Null
    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Disabled communication provider unexpectedly read threads" -Action {
        Invoke-UokJson -Path "/api/communications/threads" -Headers $OpsHeaders
    }
    Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/enable" -Headers $Headers | Out-Null
    return @{ thread_id = $threadId }
}
