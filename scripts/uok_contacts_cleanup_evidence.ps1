function Invoke-UokContactsCleanupJson {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [hashtable]$Headers = @{},
        [object]$Body = $null
    )
    $request = @{
        Uri = "$($BaseUrl.TrimEnd('/'))$Path"
        Method = $Method
        Headers = $Headers
        UseBasicParsing = $true
        TimeoutSec = 30
    }
    if ($null -ne $Body) {
        $request.ContentType = "application/json"
        $request.Body = $Body | ConvertTo-Json -Depth 20 -Compress
    }
    return Invoke-RestMethod @request
}

function Get-UokContactsCleanupHeaders {
    if (-not $env:UOK_CONTACTS_CLEANUP_PASSWORD) {
        throw "Set UOK_CONTACTS_CLEANUP_PASSWORD for the authorized cleanup operator. The value is never written to an artifact."
    }
    $login = Invoke-UokContactsCleanupJson -Method "POST" -Path "/api/auth/login" -Body @{
        username = $ContactsCleanupUsername
        password = $env:UOK_CONTACTS_CLEANUP_PASSWORD
    }
    if (-not $login.access_token) {
        throw "Contacts cleanup authentication did not return an access token."
    }
    return @{ Authorization = "Bearer $($login.access_token)" }
}

function Get-UokContactsVerifierAuditRows {
    $sql = @'
WITH verifier_groups AS (
    SELECT g.*,
           substring(g.name FROM '^Operations Contacts ([0-9]{13})$') AS stamp,
           (SELECT count(*) FROM contact_group_members AS gm
            WHERE gm.organization_id = g.organization_id AND gm.group_id = g.id) AS member_count
    FROM contact_groups AS g
    WHERE g.kind = 'manual'
      AND g.status IN ('active', 'archived')
      AND g.name ~ '^Operations Contacts [0-9]{13}$'
      AND g.description = 'Candidate verification contact group.'
), audited_groups AS (
    SELECT g.*, create_group.id AS command_log_id, created_event.id AS event_id
    FROM verifier_groups AS g
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id
          AND c.command_type = 'CreateContactGroup'
          AND c.idempotency_key = 'uok-contact-group-' || g.stamp
          AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object('name', g.name, 'description', g.description)
          AND c.response_json::jsonb ->> 'id' = g.id
        ORDER BY c.created_at ASC LIMIT 1
    ) AS create_group ON TRUE
    JOIN LATERAL (
        SELECT e.id FROM events AS e
        WHERE e.organization_id = g.organization_id
          AND e.event_type = 'ContactGroupCreated'
          AND e.object_type = 'ContactGroup'
          AND e.object_id = g.id
          AND e.payload_json::jsonb @> jsonb_build_object('name', g.name)
        ORDER BY e.created_at ASC LIMIT 1
    ) AS created_event ON TRUE
), empty_candidates AS (
    SELECT g.*, 'empty'::text AS cleanup_mode,
           NULL::text AS membership_id, NULL::text AS party_id,
           NULL::text AS create_contact_command_id, NULL::text AS add_command_id,
           NULL::text AS remove_command_id, NULL::text AS readd_command_id,
           NULL::text AS archive_contact_command_id
    FROM audited_groups AS g WHERE g.member_count = 0
), legacy_candidates AS (
    SELECT g.*, 'legacy_one_member'::text AS cleanup_mode,
           member.id AS membership_id, party.id AS party_id,
           create_contact.id AS create_contact_command_id, initial_add.id AS add_command_id,
           initial_remove.id AS remove_command_id, final_add.id AS readd_command_id,
           archive_contact.id AS archive_contact_command_id
    FROM audited_groups AS g
    JOIN contact_group_members AS member
      ON member.organization_id = g.organization_id AND member.group_id = g.id
    JOIN parties AS party
      ON party.organization_id = member.organization_id AND party.id = member.party_id
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id AND c.command_type = 'CreateContact'
          AND c.idempotency_key = 'uok-contact-' || g.stamp AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object(
              'display_name', 'UOK Contact ' || g.stamp,
              'email', 'contact-' || g.stamp || '@example.test',
              'company_name', 'UOK Account ' || g.stamp)
          AND c.response_json::jsonb ->> 'id' = party.id
          AND c.response_json::jsonb ->> 'contact_id' = party.id
        ORDER BY c.created_at ASC LIMIT 1
    ) AS create_contact ON TRUE
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id AND c.command_type = 'AddContactsToGroup'
          AND c.idempotency_key = 'uok-contact-group-add-' || g.stamp AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object('group_id', g.id, 'party_ids', jsonb_build_array(party.id))
          AND c.response_json::jsonb ->> 'added_count' = '1'
        ORDER BY c.created_at ASC LIMIT 1
    ) AS initial_add ON TRUE
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id AND c.command_type = 'RemoveContactFromGroup'
          AND c.idempotency_key = 'uok-contact-group-remove-' || g.stamp AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object('group_id', g.id, 'party_id', party.id)
          AND c.response_json::jsonb ->> 'removed_count' = '1'
        ORDER BY c.created_at ASC LIMIT 1
    ) AS initial_remove ON TRUE
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id AND c.command_type = 'AddContactsToGroup'
          AND c.idempotency_key = 'uok-contact-group-readd-' || g.stamp AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object('group_id', g.id, 'party_ids', jsonb_build_array(party.id))
          AND c.response_json::jsonb ->> 'added_count' = '1'
        ORDER BY c.created_at ASC LIMIT 1
    ) AS final_add ON TRUE
    JOIN LATERAL (
        SELECT c.id FROM command_logs AS c
        WHERE c.organization_id = g.organization_id AND c.command_type = 'ArchiveContact'
          AND c.idempotency_key = 'uok-cleanup-contact-' || party.id || '-' || g.stamp
          AND c.status = 'succeeded'
          AND c.request_json::jsonb = jsonb_build_object('party_id', party.id)
          AND c.response_json::jsonb ->> 'id' = party.id
          AND c.response_json::jsonb ->> 'status' = 'archived'
        ORDER BY c.created_at ASC LIMIT 1
    ) AS archive_contact ON TRUE
    WHERE g.member_count = 1
      AND party.party_type = 'person' AND party.status = 'archived' AND party.source = 'manual'
      AND party.display_name = 'UOK Contact ' || g.stamp
      AND (SELECT count(*) FROM contact_group_members AS exclusive
           WHERE exclusive.organization_id = g.organization_id AND exclusive.party_id = party.id) = 1
), candidates AS (
    SELECT * FROM empty_candidates UNION ALL SELECT * FROM legacy_candidates
)
SELECT json_build_object(
    'id', id, 'organization_id', organization_id, 'name', name, 'description', description,
    'kind', kind, 'status', status, 'stamp', stamp, 'created_at', created_at,
    'cleanup_mode', cleanup_mode, 'member_count', member_count,
    'membership_id', membership_id, 'party_id', party_id,
    'command_log_id', command_log_id, 'event_id', event_id,
    'create_contact_command_id', create_contact_command_id,
    'add_command_id', add_command_id, 'remove_command_id', remove_command_id,
    'readd_command_id', readd_command_id,
    'archive_contact_command_id', archive_contact_command_id
)::text
FROM candidates ORDER BY created_at ASC, id ASC;
'@
    $container = Get-UokDbContainer
    $output = & podman exec $container psql -U uok -d uok -X -A -t -v ON_ERROR_STOP=1 -c $sql
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL audit query exited with $LASTEXITCODE." }
    return @($output | Where-Object { -not [string]::IsNullOrWhiteSpace("$_") } | ForEach-Object { "$_" | ConvertFrom-Json })
}

function Get-UokContactsVerifierCandidateState {
    param([Parameter(Mandatory = $true)][hashtable]$Headers)
    $apiResponse = Invoke-UokContactsCleanupJson -Method "GET" -Path "/api/contacts/groups?kind=manual&include_empty=true&include_archived=true" -Headers $Headers
    # Windows PowerShell 5.1 can preserve a top-level JSON array as one pipeline object.
    $apiRows = @($apiResponse | ForEach-Object { $_ })
    $apiById = @{}
    foreach ($row in $apiRows) { $apiById["$($row.id)"] = $row }
    $strictRows = foreach ($audit in @(Get-UokContactsVerifierAuditRows)) {
        $api = $apiById["$($audit.id)"]
        if (-not $api -or $api.kind -ne "manual" -or $api.name -ne $audit.name) { continue }
        if ($api.description -ne $audit.description -or $api.status -ne $audit.status) { continue }
        if ([int]$api.member_count -ne [int]$audit.member_count -or [int]$api.active_member_count -ne 0) { continue }
        [ordered]@{
            id = "$($audit.id)"; name = "$($audit.name)"; description = "$($audit.description)"
            kind = "$($audit.kind)"; status = "$($audit.status)"; stamp = "$($audit.stamp)"
            created_at = "$($audit.created_at)"; cleanup_mode = "$($audit.cleanup_mode)"
            member_count = [int]$audit.member_count; active_member_count = 0
            etag = "$($api.etag)"; can_delete = [bool]$api.can_delete; can_restore = [bool]$api.can_restore
            membership_id = "$($audit.membership_id)"; party_id = "$($audit.party_id)"
            command_log_id = "$($audit.command_log_id)"; event_id = "$($audit.event_id)"
            create_contact_command_id = "$($audit.create_contact_command_id)"
            add_command_id = "$($audit.add_command_id)"; remove_command_id = "$($audit.remove_command_id)"
            readd_command_id = "$($audit.readd_command_id)"
            archive_contact_command_id = "$($audit.archive_contact_command_id)"
        }
    }
    return @($strictRows)
}
