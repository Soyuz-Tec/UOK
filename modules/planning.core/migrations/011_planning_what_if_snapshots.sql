BEGIN;

CREATE TABLE IF NOT EXISTS planning_what_if_snapshots (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    name VARCHAR(120) NOT NULL,
    snapshot_json TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    checksum VARCHAR(64) NOT NULL,
    source_revision BIGINT NOT NULL,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    correlation_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_planning_what_if_schema_version CHECK (schema_version = 1),
    CONSTRAINT ck_planning_what_if_source_revision CHECK (source_revision >= 1),
    CONSTRAINT ck_planning_what_if_checksum_length CHECK (length(checksum) = 64)
);

CREATE INDEX IF NOT EXISTS ix_planning_what_if_org_project_revision
    ON planning_what_if_snapshots (organization_id, project_id, source_revision);
CREATE INDEX IF NOT EXISTS ix_planning_what_if_org_project_created
    ON planning_what_if_snapshots (organization_id, project_id, created_at);

CREATE OR REPLACE FUNCTION reject_planning_what_if_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Planning what-if snapshots are immutable and append-only'
        USING ERRCODE = '23514';
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_planning_what_if_immutable'
          AND tgrelid = 'planning_what_if_snapshots'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_planning_what_if_immutable
                 BEFORE UPDATE OR DELETE ON planning_what_if_snapshots
                 FOR EACH ROW EXECUTE FUNCTION reject_planning_what_if_mutation()';
    END IF;
END
$$;

COMMIT;
