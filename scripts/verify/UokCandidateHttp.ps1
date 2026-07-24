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

function Get-UokModuleCatalogEntry {
    param(
        [Parameter(Mandatory = $true)][object]$Modules,
        [Parameter(Mandatory = $true)][string]$ModuleName
    )
    $property = $Modules.PSObject.Properties[$ModuleName]
    if (-not $property) {
        throw "Candidate verifier lifecycle target is not declared: $ModuleName"
    }
    return $property.Value
}

function Get-UokDependentUninstallOrder {
    param(
        [Parameter(Mandatory = $true)][object]$Modules,
        [Parameter(Mandatory = $true)][string]$ModuleName,
        [Parameter(Mandatory = $true)][hashtable]$Visited
    )
    $order = @()
    $module = Get-UokModuleCatalogEntry -Modules $Modules -ModuleName $ModuleName
    foreach ($dependentName in @($module.dependents)) {
        if (-not $dependentName -or $Visited.ContainsKey($dependentName)) {
            continue
        }
        $dependent = Get-UokModuleCatalogEntry -Modules $Modules -ModuleName $dependentName
        if ($dependent.status -notin @("installed", "upgraded", "disabled")) {
            continue
        }
        $Visited[$dependentName] = $true
        $order += @(Get-UokDependentUninstallOrder `
            -Modules $Modules `
            -ModuleName $dependentName `
            -Visited $Visited)
        $order += [pscustomobject]@{
            name = $dependentName
            status = [string]$dependent.status
        }
    }
    return $order
}

function Restore-UokUninstalledModule {
    param(
        [Parameter(Mandatory = $true)][pscustomobject]$ModuleState,
        [Parameter(Mandatory = $true)][hashtable]$Headers
    )
    $moduleName = [string]$ModuleState.name
    $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/$moduleName/install" -Headers $Headers
    if ($installed.status -ne "installed") {
        throw "Candidate verifier could not reinstall ${moduleName}: $($installed | ConvertTo-Json -Depth 10)"
    }
    if ($ModuleState.status -eq "upgraded") {
        Invoke-UokJson -Method "POST" -Path "/api/modules/$moduleName/upgrade" -Headers $Headers | Out-Null
    } elseif ($ModuleState.status -eq "disabled") {
        Invoke-UokJson -Method "POST" -Path "/api/modules/$moduleName/disable" -Headers $Headers | Out-Null
    }
}

function Invoke-UokWithModuleDisabled {
    param(
        [Parameter(Mandatory = $true)][string]$ModuleName,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    $catalog = Invoke-UokJson -Path "/api/modules/catalog" -Headers $Headers
    $target = Get-UokModuleCatalogEntry -Modules $catalog.modules -ModuleName $ModuleName
    if ($target.status -notin @("installed", "upgraded")) {
        throw "Candidate verifier lifecycle target is not operational: $ModuleName"
    }
    $dependents = @(Get-UokDependentUninstallOrder `
        -Modules $catalog.modules `
        -ModuleName $ModuleName `
        -Visited @{})
    $uninstalled = @()
    $targetDisabled = $false
    try {
        foreach ($dependent in $dependents) {
            $dependentName = [string]$dependent.name
            $result = Invoke-UokJson -Method "POST" -Path "/api/modules/$dependentName/uninstall" -Headers $Headers
            if ($result.status -ne "uninstalled") {
                throw "Candidate verifier could not suspend ${dependentName}: $($result | ConvertTo-Json -Depth 10)"
            }
            $uninstalled += $dependent
        }
        $disabled = Invoke-UokJson -Method "POST" -Path "/api/modules/$ModuleName/disable" -Headers $Headers
        if ($disabled.status -ne "disabled") {
            throw "Candidate verifier could not disable ${ModuleName}: $($disabled | ConvertTo-Json -Depth 10)"
        }
        $targetDisabled = $true
        & $Action
    } finally {
        if ($targetDisabled) {
            $enabled = Invoke-UokJson -Method "POST" -Path "/api/modules/$ModuleName/enable" -Headers $Headers
            if ($enabled.status -ne "installed") {
                throw "Candidate verifier could not restore ${ModuleName}: $($enabled | ConvertTo-Json -Depth 10)"
            }
            if ($target.status -eq "upgraded") {
                Invoke-UokJson -Method "POST" -Path "/api/modules/$ModuleName/upgrade" -Headers $Headers | Out-Null
            }
        }
        for ($index = $uninstalled.Count - 1; $index -ge 0; $index--) {
            Restore-UokUninstalledModule -ModuleState $uninstalled[$index] -Headers $Headers
        }
    }
}

function Invoke-UokWithModuleUninstalled {
    param(
        [Parameter(Mandatory = $true)][string]$ModuleName,
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][scriptblock]$Action
    )
    $catalog = Invoke-UokJson -Path "/api/modules/catalog" -Headers $Headers
    $target = Get-UokModuleCatalogEntry -Modules $catalog.modules -ModuleName $ModuleName
    if ($target.status -notin @("installed", "upgraded", "disabled")) {
        throw "Candidate verifier uninstall target is not installed: $ModuleName"
    }
    $dependents = @(Get-UokDependentUninstallOrder `
        -Modules $catalog.modules `
        -ModuleName $ModuleName `
        -Visited @{})
    $uninstalled = @()
    $targetUninstalled = $false
    try {
        foreach ($dependent in $dependents) {
            $dependentName = [string]$dependent.name
            $result = Invoke-UokJson -Method "POST" -Path "/api/modules/$dependentName/uninstall" -Headers $Headers
            if ($result.status -ne "uninstalled") {
                throw "Candidate verifier could not suspend ${dependentName}: $($result | ConvertTo-Json -Depth 10)"
            }
            $uninstalled += $dependent
        }
        $result = Invoke-UokJson -Method "POST" -Path "/api/modules/$ModuleName/uninstall" -Headers $Headers
        if ($result.status -ne "uninstalled") {
            throw "Candidate verifier could not uninstall ${ModuleName}: $($result | ConvertTo-Json -Depth 10)"
        }
        $targetUninstalled = $true
        & $Action
    } finally {
        if ($targetUninstalled) {
            $installed = Invoke-UokJson -Method "POST" -Path "/api/modules/$ModuleName/install" -Headers $Headers
            if ($installed.status -ne "installed") {
                throw "Candidate verifier could not reinstall ${ModuleName}: $($installed | ConvertTo-Json -Depth 10)"
            }
        }
        for ($index = $uninstalled.Count - 1; $index -ge 0; $index--) {
            Restore-UokUninstalledModule -ModuleState $uninstalled[$index] -Headers $Headers
        }
    }
}
