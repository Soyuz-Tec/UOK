function Assert-UokPlanningExplainableLeveling {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$BaselineId,
        [Parameter(Mandatory = $true)][string]$BaselineChecksum,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $leveled = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "LevelPlanningResources"
        payload = @{ project_id = $ProjectId; horizon_days = 5 }
        idempotency_key = "uok-planning-explainable-leveling-$Stamp"
    }
    $report = $leveled.result.leveling
    $reasonCodes = @($report.reasons | ForEach-Object { $_.code })
    if (
        $report.engine_version -ne "uok-simple-resource-leveling-2" `
        -or $report.strategy -ne "simple_forward" `
        -or $report.outcome -ne "infeasible" `
        -or $report.horizon_days -ne 5 `
        -or $report.remaining_overloads.Count -lt 1 `
        -or $report.independent_validation.ok -ne $true `
        -or $reasonCodes -notcontains "allocation_exceeds_capacity" `
        -or $reasonCodes -notcontains "horizon_exhausted"
    ) {
        throw "Planning explainable leveling evidence is invalid: $($leveled | ConvertTo-Json -Depth 30)"
    }

    $baselineAfter = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/baselines/$BaselineId" -Headers $ViewerHeaders
    if ($baselineAfter.checksum -ne $BaselineChecksum -or $baselineAfter.integrity.verified -ne $true) {
        throw "Planning leveling changed the approved baseline: $($baselineAfter | ConvertTo-Json -Depth 30)"
    }
}
