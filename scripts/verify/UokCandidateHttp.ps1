function Invoke-UokJson {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Method = "GET",
        [object]$Body = $null,
        [hashtable]$Headers = @{}
    )
    $uri = "$BaseUrl$Path"
    if ($Body -ne $null) {
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 20)
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -Headers $Headers
}

function Assert-UokHttpFailure {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][int]$StatusCode,
        [Parameter(Mandatory = $true)][string]$UnexpectedSuccessMessage
    )
    try {
        & $Action | Out-Null
        throw $UnexpectedSuccessMessage
    } catch {
        if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne $StatusCode) {
            throw
        }
    }
}

function Get-UokHttpFailureBody {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Action,
        [Parameter(Mandatory = $true)][int]$StatusCode,
        [Parameter(Mandatory = $true)][string]$UnexpectedSuccessMessage
    )
    try {
        & $Action | Out-Null
        throw $UnexpectedSuccessMessage
    } catch {
        if (-not $_.Exception.Response -or [int]$_.Exception.Response.StatusCode -ne $StatusCode) {
            throw
        }
        $message = [string]$_.ErrorDetails.Message
        if (-not $message -and $_.Exception.Response.Content) {
            $message = $_.Exception.Response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        }
        try {
            return $message | ConvertFrom-Json
        } catch {
            throw "Expected a JSON HTTP $StatusCode error body, received: $message"
        }
    }
}

function New-UokAuthHeaders {
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][string]$Password
    )
    $login = Invoke-UokJson -Method "POST" -Path "/api/auth/login" -Body @{ username = $Username; password = $Password }
    return @{ Authorization = "Bearer $($login.access_token)" }
}
