function Assert-UokPlanningMixedBatchContract {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$FirstTaskId,
        [Parameter(Mandatory = $true)][string]$SecondTaskId,
        [Parameter(Mandatory = $true)][string]$ResourceId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $initial = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $dependency = $initial.dependencies | Select-Object -First 1
    $assignment = $initial.assignments | Where-Object { $_.task_id -eq $FirstTaskId -and $_.resource_id -eq $ResourceId } | Select-Object -First 1
    if (-not $dependency.id -or -not $assignment.id) {
        throw "Planning mixed-batch prerequisites are missing: $($initial | ConvertTo-Json -Depth 20)"
    }

    $linkHeaders = $OpsHeaders.Clone()
    $linkHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $linkHeaders["Idempotency-Key"] = "uok-planning-batch-source-link-$Stamp"
    $link = Invoke-UokJson -Method "POST" -Path "/api/planning/projects/$ProjectId/links" -Headers $linkHeaders -Body @{
        scope_type = "project"
        relationship = "implements"
        target = @{ kind = "operation"; id = "candidate-batch-source-$Stamp" }
    }
    $gateHeaders = $OpsHeaders.Clone()
    $gateHeaders["If-Match"] = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $gateHeaders["Idempotency-Key"] = "uok-planning-batch-gate-$Stamp"
    $gate = Invoke-UokJson -Method "POST" -Path "/api/planning/tasks/$FirstTaskId/requirements" -Headers $gateHeaders -Body @{
        requirement_type = "approval"
        title = "Candidate mixed batch gate"
    }

    $before = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $batch = Invoke-UokPlanningBatch -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        batch_key = "mixed-$Stamp"
        reason = "Candidate ten-kind atomic proposal"
        operations = @(
            @{ operation_id = "update-task"; kind = "update_task"; payload = @{ task_id = $SecondTaskId; progress = 15 } },
            @{ operation_id = "update-dependency"; kind = "update_dependency"; payload = @{ dependency_id = $dependency.id; lag_days = 1 } },
            @{ operation_id = "remove-dependency"; kind = "remove_dependency"; payload = @{ dependency_id = $dependency.id } },
            @{ operation_id = "create-dependency"; kind = "create_dependency"; payload = @{ predecessor_task_id = $FirstTaskId; successor_task_id = $SecondTaskId } },
            @{ operation_id = "unassign-resource"; kind = "unassign_resource"; payload = @{ assignment_id = $assignment.id } },
            @{ operation_id = "assign-resource"; kind = "assign_resource"; payload = @{ task_id = $FirstTaskId; resource_id = $ResourceId; allocation_percent = 120 } },
            @{ operation_id = "set-calendar"; kind = "set_calendar"; payload = @{ name = "Batch Standard"; working_days = @(1, 2, 3, 4, 5); holidays = @(); ignored_periods = @() } },
            @{ operation_id = "remove-link"; kind = "remove_link"; payload = @{ link_id = $link.id } },
            @{ operation_id = "create-link"; kind = "create_link"; payload = @{ scope_type = "project"; relationship = "implements"; target = @{ kind = "operation"; id = "candidate-batch-final-$Stamp" } } },
            @{ operation_id = "transition-gate"; kind = "transition_gate"; payload = @{ task_id = $FirstTaskId; requirement_id = $gate.id; action = "submit" } }
        )
    }
    $submittedGate = $batch.schedule.requirements | Where-Object { $_.id -eq $gate.id } | Select-Object -First 1
    if (
        $batch.revision -ne ($before.project.revision + 1) `
        -or $batch.operation_results.Count -ne 10 `
        -or $batch.schedule.validation.ok -ne $true `
        -or $submittedGate.state -ne "submitted" `
        -or @($batch.schedule.links | Where-Object { $_.target.id -eq "candidate-batch-final-$Stamp" }).Count -ne 1
    ) {
        throw "Planning ten-kind atomic batch evidence is invalid: $($batch | ConvertTo-Json -Depth 30)"
    }

    $failureBefore = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    $failureEtag = Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders
    $failure = Get-UokHttpFailureBody -StatusCode 400 -UnexpectedSuccessMessage "Planning late mixed-batch failure unexpectedly committed" -Action {
        Invoke-UokPlanningBatch -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
            batch_key = "mixed-failure-$Stamp"
            reason = "Candidate rollback proof"
            operations = @(
                @{ operation_id = "change-first"; kind = "update_task"; payload = @{ task_id = $FirstTaskId; progress = 60 } },
                @{ operation_id = "invalid-last"; kind = "create_dependency"; payload = @{ predecessor_task_id = $FirstTaskId; successor_task_id = "missing-task" } }
            )
        }
    }
    $failureAfter = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $OpsHeaders
    if (
        $failure.error.code -ne "batch_operation_invalid" `
        -or $failureAfter.project.revision -ne $failureBefore.project.revision `
        -or (Get-UokPlanningEtag -ProjectId $ProjectId -Headers $OpsHeaders) -ne $failureEtag
    ) {
        throw "Planning mixed-batch rollback evidence is invalid: $($failure | ConvertTo-Json -Depth 20)"
    }

    $history = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/revisions?limit=200" -Headers $OpsHeaders
    $latest = $history.items | Select-Object -First 1
    $correlations = @($history.items | ForEach-Object { $_.correlation_id })
    if (
        $latest.revision -ne $batch.revision `
        -or $latest.correlation_id -ne $batch.correlation_id `
        -or $latest.outbox.event_type -ne "PlanningScheduleRevisionCommitted" `
        -or $latest.outbox.schema_version -ne 1 `
        -or -not $latest.revision_checksum `
        -or -not $latest.outbox.checksum `
        -or $latest.PSObject.Properties.Name -contains "actor_user_id" `
        -or $latest.PSObject.Properties.Name -contains "payload_json" `
        -or $latest.outbox.PSObject.Properties.Name -contains "payload_json" `
        -or $correlations.Count -ne @($correlations | Sort-Object -Unique).Count
    ) {
        throw "Planning revision/outbox history evidence is invalid: $($history | ConvertTo-Json -Depth 20)"
    }
}
