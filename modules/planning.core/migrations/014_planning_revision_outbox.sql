BEGIN;

CREATE TABLE IF NOT EXISTS planning_schedule_revisions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    revision BIGINT NOT NULL,
    previous_revision BIGINT NOT NULL,
    correlation_id TEXT NOT NULL REFERENCES command_logs(id),
    command_type VARCHAR(120) NOT NULL,
    source_command_id TEXT REFERENCES command_logs(id),
    actor_user_id TEXT NOT NULL REFERENCES users(id),
    task_versions_json TEXT NOT NULL,
    changed_task_ids_json TEXT NOT NULL,
    revision_checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_planning_schedule_revisions_project_revision
        UNIQUE (organization_id, project_id, revision),
    CONSTRAINT uq_planning_schedule_revisions_correlation
        UNIQUE (organization_id, correlation_id),
    CONSTRAINT ck_planning_schedule_revisions_revision_positive
        CHECK (revision >= 1),
    CONSTRAINT ck_planning_schedule_revisions_previous_nonnegative
        CHECK (previous_revision >= 0),
    CONSTRAINT ck_planning_schedule_revisions_sequence
        CHECK (revision = previous_revision + 1),
    CONSTRAINT ck_planning_schedule_revisions_task_versions_json
        CHECK (jsonb_typeof(task_versions_json::jsonb) = 'object'),
    CONSTRAINT ck_planning_schedule_revisions_changed_tasks_json
        CHECK (jsonb_typeof(changed_task_ids_json::jsonb) = 'array'),
    CONSTRAINT ck_planning_schedule_revisions_checksum
        CHECK (revision_checksum ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS ix_planning_schedule_revisions_org_project_created
    ON planning_schedule_revisions (organization_id, project_id, created_at);

CREATE TABLE IF NOT EXISTS planning_outbox_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    schedule_revision_id TEXT NOT NULL UNIQUE REFERENCES planning_schedule_revisions(id),
    revision BIGINT NOT NULL,
    correlation_id TEXT NOT NULL REFERENCES command_logs(id),
    event_type VARCHAR(80) NOT NULL,
    schema_version INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_planning_outbox_events_project_revision
        UNIQUE (organization_id, project_id, revision),
    CONSTRAINT uq_planning_outbox_events_correlation
        UNIQUE (organization_id, correlation_id),
    CONSTRAINT ck_planning_outbox_events_revision_positive
        CHECK (revision >= 1),
    CONSTRAINT ck_planning_outbox_events_type
        CHECK (event_type = 'PlanningScheduleRevisionCommitted'),
    CONSTRAINT ck_planning_outbox_events_schema
        CHECK (schema_version = 1),
    CONSTRAINT ck_planning_outbox_events_payload_json
        CHECK (jsonb_typeof(payload_json::jsonb) = 'object'),
    CONSTRAINT ck_planning_outbox_events_checksum
        CHECK (checksum ~ '^[a-f0-9]{64}$')
);

CREATE INDEX IF NOT EXISTS ix_planning_outbox_events_org_project_created
    ON planning_outbox_events (organization_id, project_id, created_at);

CREATE OR REPLACE FUNCTION enforce_planning_revision_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    latest_revision BIGINT;
    project_revision BIGINT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM jsonb_each(NEW.task_versions_json::jsonb)
        WHERE jsonb_typeof(value) <> 'number' OR (value::text)::BIGINT < 1
    ) OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(NEW.changed_task_ids_json::jsonb)
        WHERE jsonb_typeof(value) <> 'string'
    ) THEN
        RAISE EXCEPTION 'Planning revision JSON metadata has invalid value types';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM command_logs
        WHERE id = NEW.correlation_id
          AND organization_id = NEW.organization_id
          AND command_type = NEW.command_type
    ) THEN
        RAISE EXCEPTION 'Planning revision correlation must reference a command in the same organization';
    END IF;
    SELECT revision INTO project_revision
    FROM planning_projects
    WHERE id = NEW.project_id
      AND organization_id = NEW.organization_id
    FOR SHARE;
    IF project_revision IS NULL
       OR NEW.revision <> project_revision
       OR NEW.previous_revision <> project_revision - 1 THEN
        RAISE EXCEPTION 'Planning revision must match the current same-organization project revision';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM memberships
        WHERE organization_id = NEW.organization_id
          AND user_id = NEW.actor_user_id
    ) THEN
        RAISE EXCEPTION 'Planning revision actor must be a member of the same organization';
    END IF;
    IF NEW.source_command_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM planning_schedule_revisions source_revision
        JOIN command_logs source_command
          ON source_command.id = source_revision.correlation_id
         AND source_command.organization_id = source_revision.organization_id
        WHERE source_revision.organization_id = NEW.organization_id
          AND source_revision.project_id = NEW.project_id
          AND source_revision.correlation_id = NEW.source_command_id
          AND source_revision.revision < NEW.revision
          AND source_command.status = 'succeeded'
    ) THEN
        RAISE EXCEPTION 'Planning revision source command must reference prior history for the same project';
    END IF;
    SELECT MAX(revision) INTO latest_revision
    FROM planning_schedule_revisions
    WHERE organization_id = NEW.organization_id
      AND project_id = NEW.project_id;
    IF latest_revision IS NOT NULL
       AND (NEW.previous_revision <> latest_revision OR NEW.revision <> latest_revision + 1) THEN
        RAISE EXCEPTION 'Planning revision sequence must be contiguous after the first recorded revision';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_schedule_revisions_insert_guard ON planning_schedule_revisions;
CREATE TRIGGER planning_schedule_revisions_insert_guard
BEFORE INSERT ON planning_schedule_revisions
FOR EACH ROW EXECUTE FUNCTION enforce_planning_revision_insert();

CREATE OR REPLACE FUNCTION enforce_planning_outbox_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW.payload_json::jsonb ->> 'event_type') IS DISTINCT FROM NEW.event_type
       OR (NEW.payload_json::jsonb ->> 'schema_version')::INTEGER IS DISTINCT FROM NEW.schema_version
       OR (NEW.payload_json::jsonb ->> 'organization_id') IS DISTINCT FROM NEW.organization_id
       OR (NEW.payload_json::jsonb ->> 'project_id') IS DISTINCT FROM NEW.project_id
       OR (NEW.payload_json::jsonb ->> 'revision')::BIGINT IS DISTINCT FROM NEW.revision
       OR (NEW.payload_json::jsonb ->> 'correlation_id') IS DISTINCT FROM NEW.correlation_id
       OR (NEW.payload_json::jsonb #>> '{aggregate,type}') IS DISTINCT FROM 'PlanningProject'
       OR (NEW.payload_json::jsonb #>> '{aggregate,id}') IS DISTINCT FROM NEW.project_id THEN
        RAISE EXCEPTION 'Planning outbox payload must match its relational envelope';
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM planning_schedule_revisions ledger
        WHERE ledger.id = NEW.schedule_revision_id
          AND ledger.organization_id = NEW.organization_id
          AND ledger.project_id = NEW.project_id
          AND ledger.revision = NEW.revision
          AND ledger.correlation_id = NEW.correlation_id
          AND (NEW.payload_json::jsonb ->> 'previous_revision')::BIGINT IS NOT DISTINCT FROM ledger.previous_revision
          AND (NEW.payload_json::jsonb ->> 'command_type') IS NOT DISTINCT FROM ledger.command_type
          AND (NEW.payload_json::jsonb ->> 'source_command_id') IS NOT DISTINCT FROM ledger.source_command_id
          AND (NEW.payload_json::jsonb ->> 'actor_user_id') IS NOT DISTINCT FROM ledger.actor_user_id
          AND (NEW.payload_json::jsonb -> 'task_versions') = ledger.task_versions_json::jsonb
          AND (NEW.payload_json::jsonb -> 'changed_task_ids') = ledger.changed_task_ids_json::jsonb
          AND (NEW.payload_json::jsonb ->> 'revision_checksum') IS NOT DISTINCT FROM ledger.revision_checksum
    ) THEN
        RAISE EXCEPTION 'Planning outbox event must match its schedule revision';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS planning_outbox_events_insert_guard ON planning_outbox_events;
CREATE TRIGGER planning_outbox_events_insert_guard
BEFORE INSERT ON planning_outbox_events
FOR EACH ROW EXECUTE FUNCTION enforce_planning_outbox_insert();

CREATE OR REPLACE FUNCTION reject_planning_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Planning revision and outbox records are immutable and append-only';
END;
$$;

DROP TRIGGER IF EXISTS planning_schedule_revisions_update_guard ON planning_schedule_revisions;
CREATE TRIGGER planning_schedule_revisions_update_guard
BEFORE UPDATE OR DELETE ON planning_schedule_revisions
FOR EACH ROW EXECUTE FUNCTION reject_planning_revision_mutation();

DROP TRIGGER IF EXISTS planning_outbox_events_update_guard ON planning_outbox_events;
CREATE TRIGGER planning_outbox_events_update_guard
BEFORE UPDATE OR DELETE ON planning_outbox_events
FOR EACH ROW EXECUTE FUNCTION reject_planning_revision_mutation();

COMMIT;
