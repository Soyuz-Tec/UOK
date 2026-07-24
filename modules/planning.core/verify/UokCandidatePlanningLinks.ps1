function Assert-UokPlanningLinkContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $contacts = Invoke-UokJson -Method "POST" -Path "/api/modules/contacts.core/install" -Headers $Headers
    if ($contacts.status -notin @("installed", "upgraded")) {
        throw "Contacts provider is not operational for Planning link proof: $($contacts | ConvertTo-Json -Depth 20)"
    }
    $party = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateContact"
        payload = @{ display_name = "Planning linked owner $Stamp" }
        idempotency_key = "uok-planning-link-party-$Stamp"
    }
    $linkHeaders = $OpsHeaders.Clone()
    $linkHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $linkHeaders["Idempotency-Key"] = "uok-planning-link-create-$Stamp"
    $link = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/links" -Headers $linkHeaders -Body @{
        scope_type = "task"
        task_id = $TaskId
        relationship = "owned_by"
        target = @{ kind = "party"; id = $party.result.id }
    }
    if (
        -not $link.id `
        -or $link.target.id -ne $party.result.id `
        -or $link.target.resolver -ne "contacts.party" `
        -or $link.resolution.status -ne "ready" `
        -or $link.correlation_id -eq $null
    ) {
        throw "Planning party link did not resolve with correlated evidence: $($link | ConvertTo-Json -Depth 20)"
    }

    $operationHeaders = $OpsHeaders.Clone()
    $operationHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $operationHeaders["Idempotency-Key"] = "uok-planning-link-operation-$Stamp"
    $operationLink = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/links" -Headers $operationHeaders -Body @{
        scope_type = "project"
        relationship = "implements"
        target = @{ kind = "operation"; id = "operation-$Stamp" }
    }
    if ($operationLink.resolution.status -ne "unavailable" -or $operationLink.target.resolver -ne "operation.provider") {
        throw "Missing optional Operation provider was not represented safely: $($operationLink | ConvertTo-Json -Depth 20)"
    }

    $viewerHeadersWithRevision = $ViewerHeaders.Clone()
    $viewerHeadersWithRevision["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $ViewerHeaders
    $viewerHeadersWithRevision["Idempotency-Key"] = "uok-planning-link-denied-$Stamp"
    $denied = Get-UokHttpFailureBody -StatusCode 403 -UnexpectedSuccessMessage "Viewer Planning link unexpectedly succeeded" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/links" -Headers $viewerHeadersWithRevision -Body @{
            scope_type = "project"
            relationship = "owned_by"
            target = @{ kind = "party"; id = $party.result.id }
        }
    }
    if ($denied.error.code -ne "permission_denied") {
        throw "Planning link capability denial is invalid: $($denied | ConvertTo-Json -Depth 20)"
    }

    Invoke-UokWithModuleDisabled -ModuleName "contacts.core" -Headers $Headers -Action {
        $unavailable = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
        $partyLink = $unavailable.links | Where-Object { $_.id -eq $link.id } | Select-Object -First 1
        if (-not $partyLink -or $partyLink.resolution.status -ne "unavailable") {
            throw "Disabled target module removed or leaked the Planning link: $($unavailable.links | ConvertTo-Json -Depth 20)"
        }
    }

    $communications = Invoke-UokJson -Method "POST" -Path "/api/modules/communications.core/install" -Headers $Headers
    if ($communications.status -notin @("installed", "upgraded")) {
        throw "Communications provider is not operational for Planning link proof: $($communications | ConvertTo-Json -Depth 20)"
    }
    $thread = Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $OpsHeaders -Body @{
        command_type = "CreateCommunicationThread"
        payload = @{ title = "Planning K Connect room $Stamp"; context_type = "planning.task"; context_id = $TaskId }
        idempotency_key = "uok-planning-thread-source-$Stamp"
    }
    $threadHeaders = $OpsHeaders.Clone()
    $threadHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $threadHeaders["Idempotency-Key"] = "uok-planning-thread-link-$Stamp"
    $threadLink = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/links" -Headers $threadHeaders -Body @{
        scope_type = "task"
        task_id = $TaskId
        relationship = "discussed_in"
        target = @{ kind = "communication_thread"; id = $thread.result.id }
    }
    if (
        $threadLink.resolution.status -ne "ready" `
        -or $threadLink.target.resolver -ne "kconnect.thread" `
        -or $threadLink.resolution.open_path -ne "/?view=communications&thread_id=$($thread.result.id)"
    ) {
        throw "Planning communication thread link is invalid: $($threadLink | ConvertTo-Json -Depth 20)"
    }
    $financeHeaders = New-UokAuthHeaders -Username "finance" -Password "finance123"
    $financeSchedule = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $financeHeaders
    $hiddenThread = $financeSchedule.links | Where-Object { $_.id -eq $threadLink.id } | Select-Object -First 1
    if ($hiddenThread.resolution.status -ne "denied" -or $hiddenThread.target.id -ne $null -or $hiddenThread.resolution.open_path -ne $null) {
        throw "Planning communication permission boundary leaked thread identity: $($hiddenThread | ConvertTo-Json -Depth 20)"
    }
    Invoke-UokWithModuleDisabled -ModuleName "communications.core" -Headers $Headers -Action {
        $threadUnavailable = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
        $disabledThread = $threadUnavailable.links | Where-Object { $_.id -eq $threadLink.id } | Select-Object -First 1
        if ($disabledThread.resolution.status -ne "unavailable" -or $disabledThread.resolution.open_path -ne $null) {
            throw "Disabled Communications provider did not fail closed: $($disabledThread | ConvertTo-Json -Depth 20)"
        }
    }
    return @{ party_link_id = $link.id }
}
