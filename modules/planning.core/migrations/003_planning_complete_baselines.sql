ALTER TABLE planning_baselines
    ADD COLUMN IF NOT EXISTS schema_version INTEGER,
    ADD COLUMN IF NOT EXISTS completeness VARCHAR(20),
    ADD COLUMN IF NOT EXISTS checksum VARCHAR(64),
    ADD COLUMN IF NOT EXISTS source_revision BIGINT,
    ADD COLUMN IF NOT EXISTS created_by_user_id TEXT REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS correlation_id VARCHAR(36);

UPDATE planning_baselines
SET schema_version = COALESCE(schema_version, 1),
    completeness = COALESCE(completeness, 'partial')
WHERE schema_version IS NULL OR completeness IS NULL;

ALTER TABLE planning_baselines
    ALTER COLUMN schema_version SET DEFAULT 2,
    ALTER COLUMN schema_version SET NOT NULL,
    ALTER COLUMN completeness SET DEFAULT 'complete',
    ALTER COLUMN completeness SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_baselines_schema_version_positive'
          AND conrelid = 'planning_baselines'::regclass
    ) THEN
        ALTER TABLE planning_baselines
            ADD CONSTRAINT ck_planning_baselines_schema_version_positive
            CHECK (schema_version >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_baselines_completeness'
          AND conrelid = 'planning_baselines'::regclass
    ) THEN
        ALTER TABLE planning_baselines
            ADD CONSTRAINT ck_planning_baselines_completeness
            CHECK (completeness IN ('partial', 'complete'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_planning_core_baselines_org_project_revision
    ON planning_baselines (organization_id, project_id, source_revision);

CREATE OR REPLACE FUNCTION reject_planning_baseline_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Planning baselines are immutable and append-only'
        USING ERRCODE = '23514';
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_planning_baselines_immutable'
          AND tgrelid = 'planning_baselines'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_planning_baselines_immutable
                 BEFORE UPDATE OR DELETE ON planning_baselines
                 FOR EACH ROW EXECUTE FUNCTION reject_planning_baseline_mutation()';
    END IF;
END
$$;
