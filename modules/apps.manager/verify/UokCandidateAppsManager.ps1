function Invoke-UokAppsManagerCandidateScenario {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $catalog = Invoke-UokJson -Path "/api/modules/catalog" -Headers $Headers
    $viewerCatalog = Invoke-UokJson -Path "/api/modules/catalog" -Headers $ViewerHeaders
    $appsManager = $catalog.modules.'apps.manager'
    if (
        -not $appsManager `
        -or $appsManager.status -notin @("installed", "upgraded") `
        -or $appsManager.required -ne $true `
        -or $appsManager.uninstallable -ne $false `
        -or -not $viewerCatalog.modules.'apps.manager'
    ) {
        throw "Apps Manager catalog contract is invalid: $($catalog | ConvertTo-Json -Depth 30)"
    }

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Required Apps Manager unexpectedly disabled" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/modules/apps.manager/disable" -Headers $Headers
    }
    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Required Apps Manager unexpectedly uninstalled" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/modules/apps.manager/uninstall" -Headers $Headers
    }
    Assert-UokHttpFailure -StatusCode 403 -UnexpectedSuccessMessage "Viewer unexpectedly reconciled module state" -Action {
        Invoke-UokJson -Method "POST" -Path "/api/modules/agents.core/reconcile" -Headers $ViewerHeaders
    }

    $reconciliation = Invoke-UokJson -Method "POST" -Path "/api/modules/agents.core/reconcile" -Headers $Headers
    if (
        -not $reconciliation.module `
        -or $reconciliation.module.status -ne "available" `
        -or $reconciliation.module.maturity -ne "integration_tested" `
        -or $reconciliation.module.installable -ne $true `
        -or $reconciliation.module.reconciliation_required -ne $false
    ) {
        throw "Apps Manager reconciliation contract is invalid: $($reconciliation | ConvertTo-Json -Depth 20)"
    }

    $maintenance = Invoke-UokJson -Path "/api/modules/apps.manager/maintenance" -Headers $OpsHeaders
    if (-not $maintenance.ok -or $maintenance.module.name -ne "apps.manager") {
        throw "Apps Manager maintenance contract is invalid: $($maintenance | ConvertTo-Json -Depth 20)"
    }
    return @{
        module = "apps.manager"
        status = $appsManager.status
        catalog_count = @($catalog.modules.psobject.Properties).Count
        reconciliation_performed = $reconciliation.reconciled
    }
}
