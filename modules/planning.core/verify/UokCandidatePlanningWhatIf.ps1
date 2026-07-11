function Assert-UokPlanningWhatIfSnapshot {
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId,
        [Parameter(Mandatory = $true)][string]$TaskId,
        [Parameter(Mandatory = $true)][hashtable]$OpsHeaders,
        [Parameter(Mandatory = $true)][hashtable]$ViewerHeaders,
        [Parameter(Mandatory = $true)][long]$Stamp
    )

    $before = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $ViewerHeaders
    $beforeTask = $before.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    $created = Invoke-UokPlanningCommand -ProjectId $ProjectId -Headers $OpsHeaders -Body @{
        command_type = "CreatePlanningWhatIfSnapshot"
        payload = @{
            project_id = $ProjectId
            name = "Candidate what-if $Stamp"
            task_changes = @(@{ task_id = $TaskId; start = "2026-08-04"; end = "2026-08-06"; progress = 45 })
        }
        idempotency_key = "uok-planning-what-if-$Stamp"
    }
    $metadata = $created.result.what_if_snapshot
    if (
        $metadata.schema_version -ne 1 `
        -or $metadata.source_revision -ne $before.project.revision `
        -or $metadata.integrity.verified -ne $true `
        -or $metadata.checksum.Length -ne 64 `
        -or $metadata.correlation_id -ne $created.command_id
    ) {
        throw "Planning what-if metadata is invalid: $($created | ConvertTo-Json -Depth 30)"
    }

    $detail = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/what-if-snapshots/$($metadata.id)" -Headers $ViewerHeaders
    $approvedTask = $detail.snapshot.approved.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    $previewTask = $detail.snapshot.preview.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    if (
        $detail.snapshot.proposal.temporary -ne $true `
        -or $approvedTask.start -ne $beforeTask.start `
        -or $previewTask.start -ne "2026-08-04" `
        -or $previewTask.end -ne "2026-08-06" `
        -or $previewTask.progress -ne 45
    ) {
        throw "Planning what-if preview is invalid: $($detail | ConvertTo-Json -Depth 40)"
    }

    $after = Invoke-UokJson -Path "/api/planning/projects/$ProjectId/schedule" -Headers $ViewerHeaders
    $afterTask = $after.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    if (
        $afterTask.start -ne $beforeTask.start `
        -or $afterTask.end -ne $beforeTask.end `
        -or $afterTask.progress -ne $beforeTask.progress `
        -or $afterTask.version -ne $beforeTask.version `
        -or $after.project.revision -ne ($before.project.revision + 1)
    ) {
        throw "Planning what-if mutated the approved schedule: $($after | ConvertTo-Json -Depth 30)"
    }
    return @{ snapshot_id = $metadata.id }
}
