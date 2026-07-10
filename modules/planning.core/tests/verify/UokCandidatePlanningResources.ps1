function Assert-UokPlanningTypedResourceContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    Assert-UokHttpFailure -StatusCode 400 -UnexpectedSuccessMessage "Invalid typed resource unit unexpectedly succeeded" -Action {
        Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
            command_type = "CreatePlanningResource"
            payload = @{ project_id = $ProjectId; name = "Invalid vehicle"; resource_type = "vehicle"; capacity_value = 1; capacity_unit = "fte" }
            idempotency_key = "uok-planning-invalid-resource-$Stamp"
        }
    }

    $resource = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningResource"
        payload = @{
            project_id = $ProjectId
            name = "Candidate Planner"
            role = "Scheduling"
            resource_type = "human"
            capacity_value = 0.5
            capacity_unit = "fte"
            effective_start = "2026-08-01"
            effective_end = "2026-08-31"
        }
        idempotency_key = "uok-planning-resource-$Stamp"
    }
    $resourceRow = $resource.result.resources | Where-Object { $_.name -eq "Candidate Planner" } | Select-Object -First 1
    if (
        $resourceRow.resource_type -ne "human" `
        -or $resourceRow.capacity_value -ne 0.5 `
        -or $resourceRow.capacity_unit -ne "fte" `
        -or $resourceRow.effective_start -ne "2026-08-01" `
        -or $resourceRow.effective_end -ne "2026-08-31"
    ) {
        throw "Planning typed resource readback is invalid: $($resource | ConvertTo-Json -Depth 30)"
    }
    $assigned = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "AssignPlanningResource"
        payload = @{ task_id = $TaskId; resource_id = $resourceRow.id; allocation_percent = 120 }
        idempotency_key = "uok-planning-assignment-$Stamp"
    }
    if (
        $assigned.result.calculation.resource_capacity.independent_validation.ok -ne $true `
        -or $assigned.result.calculation.resource_capacity.overallocated_count -lt 1 `
        -or @($assigned.result.calculation.resource_capacity.load_points | Where-Object { $_.allocation_percent -eq 120 -and $_.overallocated }).Count -lt 1
    ) {
        throw "Planning resource-capacity evidence is invalid: $($assigned | ConvertTo-Json -Depth 30)"
    }
    return @{ resource_id = $resourceRow.id }
}
