. (Join-Path $PSScriptRoot "uok_contacts_cleanup_evidence.ps1")

function Resolve-UokContactsCleanupArtifactPath {
    param([string]$RequestedPath, [string]$Suffix)
    if ($RequestedPath) {
        $path = if ([System.IO.Path]::IsPathRooted($RequestedPath)) {
            $RequestedPath
        } else {
            Join-Path $RepoRoot $RequestedPath
        }
    } else {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $path = Join-Path $RepoRoot "var\operations\contacts\contacts_verifier_group_cleanup_${stamp}.${Suffix}.json"
    }
    $fullPath = [System.IO.Path]::GetFullPath($path)
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $fullPath) | Out-Null
    return $fullPath
}

function Write-UokContactsCleanupArtifact {
    param(
        [Parameter(Mandatory = $true)][object]$Artifact,
        [Parameter(Mandatory = $true)][string]$Path
    )
    $Artifact | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
    $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    Write-Host "Contacts cleanup artifact: $Path"
    Write-Host "SHA-256: $hash"
}

function Get-UokContactsCleanupPlan {
    if (-not $ContactsCleanupPlanPath -or -not (Test-Path -LiteralPath $ContactsCleanupPlanPath -PathType Leaf)) {
        throw "Execution requires an existing reviewed -ContactsCleanupPlanPath from a dry run."
    }
    $plan = Get-Content -Raw -LiteralPath $ContactsCleanupPlanPath | ConvertFrom-Json
    if ($plan.schema -ne "uok.contacts-verifier-group-cleanup.v2" -or $plan.mode -ne "dry_run") {
        throw "Execution requires a v2 dry-run Contacts cleanup plan."
    }
    if ($plan.base_url -ne $BaseUrl.TrimEnd('/') -or $plan.project_name -ne $ProjectName) {
        throw "Cleanup plan target does not match the requested BaseUrl and ProjectName."
    }
    $candidates = @($plan.candidates)
    if ([int]$plan.candidate_count -ne $candidates.Count) {
        throw "Cleanup plan candidate_count does not match its candidate rows."
    }
    $ids = @($candidates | ForEach-Object { "$($_.id)" })
    if (@($ids | Where-Object { -not $_ }).Count -gt 0 -or @($ids | Select-Object -Unique).Count -ne $ids.Count) {
        throw "Cleanup plan candidate IDs must be non-empty and unique."
    }
    foreach ($candidate in $candidates) {
        if (-not $candidate.name -or -not $candidate.stamp -or -not $candidate.command_log_id -or -not $candidate.event_id) {
            throw "Every cleanup candidate requires immutable group and creation evidence."
        }
        if ($candidate.cleanup_mode -notin @("empty", "legacy_one_member")) {
            throw "Unsupported Contacts cleanup candidate mode."
        }
        if ($candidate.cleanup_mode -eq "legacy_one_member") {
            $legacyEvidence = @(
                $candidate.membership_id, $candidate.party_id, $candidate.create_contact_command_id,
                $candidate.add_command_id, $candidate.remove_command_id, $candidate.readd_command_id,
                $candidate.archive_contact_command_id
            )
            if (@($legacyEvidence | Where-Object { -not $_ }).Count -gt 0) {
                throw "Legacy one-member candidates require the complete verifier command chain."
            }
        }
    }
    return $plan
}

function Test-UokContactsCleanupCandidateMatch {
    param(
        [Parameter(Mandatory = $true)][object]$Planned,
        [Parameter(Mandatory = $true)][object]$Live
    )
    if ($Live.id -ne $Planned.id -or $Live.name -ne $Planned.name -or $Live.stamp -ne $Planned.stamp) {
        return $false
    }
    if ($Live.description -ne $Planned.description -or $Live.command_log_id -ne $Planned.command_log_id) {
        return $false
    }
    if ($Live.event_id -ne $Planned.event_id) { return $false }
    if ($Planned.cleanup_mode -eq "empty") { return $Live.cleanup_mode -eq "empty" }
    if ($Live.cleanup_mode -eq "empty") { return $true }
    return $Live.cleanup_mode -eq "legacy_one_member" -and $Live.party_id -eq $Planned.party_id `
        -and $Live.membership_id -eq $Planned.membership_id `
        -and $Live.create_contact_command_id -eq $Planned.create_contact_command_id `
        -and $Live.add_command_id -eq $Planned.add_command_id `
        -and $Live.remove_command_id -eq $Planned.remove_command_id `
        -and $Live.readd_command_id -eq $Planned.readd_command_id `
        -and $Live.archive_contact_command_id -eq $Planned.archive_contact_command_id
}

function Invoke-UokContactsVerifierMembershipRemoval {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][string]$GroupId,
        [Parameter(Mandatory = $true)][string]$PartyId
    )
    $response = Invoke-UokContactsCleanupJson -Method "POST" -Path "/api/commands" -Headers $Headers -Body @{
        command_type = "RemoveContactFromGroup"
        payload = @{ group_id = $GroupId; party_id = $PartyId }
        idempotency_key = "uok-contacts-verifier-membership-cleanup-$GroupId-$PartyId"
    }
    if ([int]$response.result.removed_count -ne 1) {
        throw "RemoveContactFromGroup did not remove the exact legacy membership for group $GroupId."
    }
}

function Invoke-UokContactsVerifierGroupArchive {
    param(
        [Parameter(Mandatory = $true)][hashtable]$Headers,
        [Parameter(Mandatory = $true)][string]$GroupId
    )
    $response = Invoke-UokContactsCleanupJson -Method "POST" -Path "/api/commands" -Headers $Headers -Body @{
        command_type = "ArchiveContactGroup"
        payload = @{ group_id = $GroupId }
        idempotency_key = "uok-contacts-verifier-group-archive-$GroupId"
    }
    if ($response.result.status -ne "archived") {
        throw "ArchiveContactGroup did not return archived for group $GroupId."
    }
}

function Invoke-UokContactsVerifierGroupCleanup {
    Invoke-UokStep "Contacts verifier-group cleanup" {
        if ($ConfirmContactsCleanup -and -not $ExecuteContactsCleanup) {
            throw "-ConfirmContactsCleanup is valid only with -ExecuteContactsCleanup."
        }
        $headers = Get-UokContactsCleanupHeaders
        if (-not $ExecuteContactsCleanup) {
            $candidates = @(Get-UokContactsVerifierCandidateState -Headers $headers | Where-Object { $_.status -eq "active" })
            $planPath = Resolve-UokContactsCleanupArtifactPath -RequestedPath $ContactsCleanupPlanPath -Suffix "plan"
            $plan = [ordered]@{
                schema = "uok.contacts-verifier-group-cleanup.v2"
                mode = "dry_run"
                generated_at = (Get-Date).ToUniversalTime().ToString("o")
                base_url = $BaseUrl.TrimEnd('/')
                project_name = $ProjectName
                criteria = "exact audited empty groups or exact one-member legacy verifier chains; API reconciled and active only"
                backup_required_for_execution = $true
                candidate_count = $candidates.Count
                candidates = $candidates
            }
            Write-UokContactsCleanupArtifact -Artifact $plan -Path $planPath
            Write-Host "Dry run found $($candidates.Count) recoverably archivable verifier group(s). No records were changed."
            return
        }
        if (-not $ConfirmContactsCleanup) {
            throw "Execution requires -ExecuteContactsCleanup and -ConfirmContactsCleanup."
        }
        if (-not $BackupPath -or -not (Test-Path -LiteralPath $BackupPath -PathType Leaf)) {
            throw "Execution requires -BackupPath pointing to an existing reviewed database dump."
        }
        if ((Get-Item -LiteralPath $BackupPath).Length -lt 1) {
            throw "Execution requires a non-empty reviewed database dump."
        }
        $plan = Get-UokContactsCleanupPlan
        $plannedRows = @($plan.candidates)
        $liveRows = @(Get-UokContactsVerifierCandidateState -Headers $headers)
        foreach ($planned in $plannedRows) {
            $live = @($liveRows | Where-Object { $_.id -eq $planned.id })
            if ($live.Count -ne 1 -or -not (Test-UokContactsCleanupCandidateMatch -Planned $planned -Live $live[0])) {
                throw "Group $($planned.id) no longer satisfies its reviewed verifier evidence; nothing was archived."
            }
        }
        $results = @()
        $failure = $null
        $currentResult = $null
        try {
            foreach ($planned in $plannedRows) {
                $currentResult = [ordered]@{
                    id = "$($planned.id)"; party_id = "$($planned.party_id)"
                    membership_outcome = "not_started"; outcome = "revalidation_started"
                }
                $current = @(Get-UokContactsVerifierCandidateState -Headers $headers | Where-Object { $_.id -eq $planned.id })
                if ($current.Count -ne 1 -or -not (Test-UokContactsCleanupCandidateMatch -Planned $planned -Live $current[0])) {
                    throw "Group $($planned.id) changed during execution; remaining groups were not archived."
                }
                if ($current[0].status -eq "archived") {
                    $currentResult.membership_outcome = "unchanged"
                    $currentResult.outcome = "already_archived"
                    $results += $currentResult
                    $currentResult = $null
                    continue
                }
                $membershipOutcome = "not_present"
                if ($current[0].cleanup_mode -eq "legacy_one_member") {
                    $currentResult.membership_outcome = "removal_started"
                    Invoke-UokContactsVerifierMembershipRemoval -Headers $headers -GroupId $planned.id -PartyId $planned.party_id
                    $membershipOutcome = "removed"
                    $currentResult.membership_outcome = $membershipOutcome
                    $currentResult.outcome = "membership_removed_pending_archive"
                    $empty = @(Get-UokContactsVerifierCandidateState -Headers $headers | Where-Object {
                        $_.id -eq $planned.id -and $_.status -eq "active" -and $_.cleanup_mode -eq "empty"
                    })
                    if ($empty.Count -ne 1) { throw "Group $($planned.id) was not strictly empty after membership removal." }
                } elseif ($planned.cleanup_mode -eq "legacy_one_member") {
                    $membershipOutcome = "already_absent"
                    $currentResult.membership_outcome = $membershipOutcome
                }
                $currentResult.outcome = "archive_started"
                Invoke-UokContactsVerifierGroupArchive -Headers $headers -GroupId $planned.id
                $archived = @(Get-UokContactsVerifierCandidateState -Headers $headers | Where-Object {
                    $_.id -eq $planned.id -and $_.status -eq "archived" -and $_.cleanup_mode -eq "empty"
                })
                if ($archived.Count -ne 1) { throw "Group $($planned.id) did not pass archived API/DB readback." }
                $currentResult.membership_outcome = $membershipOutcome
                $currentResult.outcome = "archived"
                $results += $currentResult
                $currentResult = $null
            }
        } catch {
            if ($null -ne $currentResult) { $results += $currentResult }
            $failure = $_.Exception.Message
        }
        $reportPath = Resolve-UokContactsCleanupArtifactPath -RequestedPath "" -Suffix "execution"
        $report = [ordered]@{
            schema = "uok.contacts-verifier-group-cleanup.execution.v2"
            recorded_at = (Get-Date).ToUniversalTime().ToString("o")
            base_url = $BaseUrl.TrimEnd('/'); project_name = $ProjectName
            reviewed_plan = [System.IO.Path]::GetFullPath($ContactsCleanupPlanPath)
            verified_backup = [System.IO.Path]::GetFullPath($BackupPath)
            failure = $failure; result_count = $results.Count; results = $results
        }
        Write-UokContactsCleanupArtifact -Artifact $report -Path $reportPath
        if ($failure) { throw $failure }
        Write-Host "Archive execution completed for $($results.Count) verifier group(s). No group or contact was deleted."
    }
}
