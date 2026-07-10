\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    target_id TEXT;
    rejected BOOLEAN := FALSE;
BEGIN
    SELECT id INTO target_id FROM planning_schedule_revisions ORDER BY created_at DESC LIMIT 1;
    IF target_id IS NULL THEN
        RAISE EXCEPTION 'revision guard probe requires at least one revision row';
    END IF;
    BEGIN
        UPDATE planning_schedule_revisions SET command_type = 'tampered' WHERE id = target_id;
    EXCEPTION WHEN OTHERS THEN
        IF POSITION('immutable and append-only' IN SQLERRM) > 0 THEN rejected := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'revision update guard unexpectedly allowed mutation'; END IF;
END;
$$;

DO $$
DECLARE
    target_id TEXT;
    rejected BOOLEAN := FALSE;
BEGIN
    SELECT id INTO target_id FROM planning_outbox_events ORDER BY created_at DESC LIMIT 1;
    IF target_id IS NULL THEN
        RAISE EXCEPTION 'outbox guard probe requires at least one outbox row';
    END IF;
    BEGIN
        DELETE FROM planning_outbox_events WHERE id = target_id;
    EXCEPTION WHEN OTHERS THEN
        IF POSITION('immutable and append-only' IN SQLERRM) > 0 THEN rejected := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'outbox delete guard unexpectedly allowed mutation'; END IF;
END;
$$;

DO $$
DECLARE
    ledger planning_schedule_revisions%ROWTYPE;
    rejected BOOLEAN := FALSE;
BEGIN
    SELECT * INTO ledger FROM planning_schedule_revisions ORDER BY created_at DESC LIMIT 1;
    BEGIN
        INSERT INTO planning_outbox_events (
            id, organization_id, project_id, schedule_revision_id, revision,
            correlation_id, event_type, schema_version, payload_json, checksum, created_at
        ) VALUES (
            'probe-outbox-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 20),
            ledger.organization_id, ledger.project_id, ledger.id, ledger.revision,
            ledger.correlation_id, 'PlanningScheduleRevisionCommitted', 1, '{}', REPEAT('a', 64), NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        IF POSITION('relational envelope' IN SQLERRM) > 0 THEN rejected := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'outbox envelope guard unexpectedly accepted empty payload'; END IF;
END;
$$;

DO $$
DECLARE
    existing planning_schedule_revisions%ROWTYPE;
    probe_org TEXT := 'probe-org-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 20);
    probe_user TEXT := 'probe-user-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 20);
    probe_command TEXT := 'probe-cmd-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 22);
    rejected BOOLEAN := FALSE;
BEGIN
    SELECT * INTO existing FROM planning_schedule_revisions ORDER BY created_at DESC LIMIT 1;
    INSERT INTO organizations (id, name) VALUES (probe_org, probe_org);
    INSERT INTO users (id, username, password_hash, display_name)
        VALUES (probe_user, probe_user, REPEAT('x', 64), 'Revision probe');
    INSERT INTO memberships (id, organization_id, user_id, role)
        VALUES ('probe-mem-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 22), probe_org, probe_user, 'ops_manager');
    INSERT INTO command_logs (
        id, organization_id, command_type, idempotency_key, status, request_json, response_json, created_at
    ) VALUES (
        probe_command, probe_org, 'CreatePlanningProject', probe_command, 'received', '{}', '{}', NOW()
    );
    BEGIN
        INSERT INTO planning_schedule_revisions (
            id, organization_id, project_id, revision, previous_revision, correlation_id,
            command_type, actor_user_id, task_versions_json, changed_task_ids_json,
            revision_checksum, created_at
        ) VALUES (
            'probe-rev-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 22), probe_org, existing.project_id,
            existing.revision, existing.previous_revision, probe_command, 'CreatePlanningProject',
            probe_user, '{}', '[]', REPEAT('a', 64), NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        IF POSITION('same-organization project revision' IN SQLERRM) > 0 THEN rejected := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'cross-organization project guard unexpectedly accepted revision'; END IF;
END;
$$;

DO $$
DECLARE
    target_project TEXT;
    target_org TEXT;
    target_revision BIGINT;
    source_command TEXT;
    actor_user TEXT;
    probe_command TEXT := 'probe-cmd-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 22);
    rejected BOOLEAN := FALSE;
BEGIN
    SELECT project.id, project.organization_id, project.revision, source.correlation_id
    INTO target_project, target_org, target_revision, source_command
    FROM planning_projects project
    JOIN planning_schedule_revisions current_revision
      ON current_revision.organization_id = project.organization_id
     AND current_revision.project_id = project.id
     AND current_revision.revision = project.revision
    JOIN planning_schedule_revisions source
      ON source.organization_id = project.organization_id
     AND source.project_id <> project.id
    JOIN command_logs source_log
      ON source_log.id = source.correlation_id
     AND source_log.status = 'succeeded'
    LIMIT 1;
    SELECT user_id INTO actor_user FROM memberships WHERE organization_id = target_org LIMIT 1;
    IF target_project IS NULL OR actor_user IS NULL THEN
        RAISE EXCEPTION 'source-command guard probe requires two recorded projects and one member';
    END IF;
    BEGIN
        INSERT INTO command_logs (
            id, organization_id, command_type, idempotency_key, status, request_json, response_json, created_at
        ) VALUES (
            probe_command, target_org, 'BatchPlanningOperations', probe_command, 'received', '{}', '{}', NOW()
        );
        UPDATE planning_projects SET revision = target_revision + 1 WHERE id = target_project;
        INSERT INTO planning_schedule_revisions (
            id, organization_id, project_id, revision, previous_revision, correlation_id,
            command_type, source_command_id, actor_user_id, task_versions_json,
            changed_task_ids_json, revision_checksum, created_at
        ) VALUES (
            'probe-rev-' || SUBSTRING(MD5(RANDOM()::TEXT), 1, 22), target_org, target_project,
            target_revision + 1, target_revision, probe_command, 'BatchPlanningOperations',
            source_command, actor_user, '{}', '[]', REPEAT('a', 64), NOW()
        );
    EXCEPTION WHEN OTHERS THEN
        IF POSITION('same project' IN SQLERRM) > 0 THEN rejected := TRUE; ELSE RAISE; END IF;
    END;
    IF NOT rejected THEN RAISE EXCEPTION 'foreign-project source command unexpectedly accepted'; END IF;
END;
$$;

ROLLBACK;

SELECT 'revision_outbox_guard_probes_passed' AS status;
