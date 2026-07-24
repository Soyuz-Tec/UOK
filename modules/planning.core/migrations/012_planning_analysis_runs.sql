BEGIN;

CREATE TABLE IF NOT EXISTS planning_analysis_runs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    snapshot_id TEXT NOT NULL REFERENCES planning_what_if_snapshots(id),
    analysis_type VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL,
    engine_name VARCHAR(80) NOT NULL,
    engine_version VARCHAR(40) NOT NULL,
    seed BIGINT,
    inputs_json TEXT NOT NULL,
    limits_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    correlation_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_planning_analysis_run_type CHECK (analysis_type IN ('risk', 'optimization')),
    CONSTRAINT ck_planning_analysis_run_status CHECK (status IN ('completed', 'timeout', 'infeasible')),
    CONSTRAINT ck_planning_analysis_run_seed CHECK (seed IS NULL OR seed >= 0),
    CONSTRAINT ck_planning_analysis_run_checksum_length CHECK (length(checksum) = 64)
);

CREATE INDEX IF NOT EXISTS ix_planning_analysis_runs_org_project_type
    ON planning_analysis_runs (organization_id, project_id, analysis_type, created_at);
CREATE INDEX IF NOT EXISTS ix_planning_analysis_runs_org_snapshot
    ON planning_analysis_runs (organization_id, snapshot_id, created_at);

CREATE OR REPLACE FUNCTION reject_planning_analysis_run_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Planning analysis runs are immutable and append-only'
        USING ERRCODE = '23514';
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_planning_analysis_runs_immutable'
          AND tgrelid = 'planning_analysis_runs'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_planning_analysis_runs_immutable
                 BEFORE UPDATE OR DELETE ON planning_analysis_runs
                 FOR EACH ROW EXECUTE FUNCTION reject_planning_analysis_run_mutation()';
    END IF;
END
$$;

COMMIT;
