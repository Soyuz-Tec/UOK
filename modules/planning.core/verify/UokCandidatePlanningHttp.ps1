function Get-UokPlanningEtag {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$Headers
    )
    $response = Invoke-WebRequest -UseBasicParsing -Method "GET" -Uri "$BaseUrl/api/planning/projects/$ProjectId/schedule" -Headers $Headers
    $etag = [string]$response.Headers["ETag"]
    if (-not $etag -or $etag -notmatch '^"planning-r[1-9][0-9]*-sha256-[a-f0-9]{64}"$') {
        throw "Planning schedule did not return a valid strong ETag: $etag"
    }
    return $etag
}

function Invoke-UokPlanningCommand {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )
    $conditionalHeaders = $Headers.Clone()
    $conditionalHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $Headers
    return Invoke-UokJson -Method "POST" -Path "/api/commands" -Headers $conditionalHeaders -Body $Body
}

function Invoke-UokPlanningBatch {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$Body
    )
    $conditionalHeaders = $Headers.Clone()
    $conditionalHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $Headers
    $conditionalHeaders["Idempotency-Key"] = "uok-planning-batch-$($Body.batch_key)"
    $payload = @{ operations = $Body.operations; reason = $Body.reason }
    if ($Body.source_command_id) {
        $payload.source_command_id = $Body.source_command_id
    }
    return Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/mutations:batch" -Headers $conditionalHeaders -Body $payload
}
