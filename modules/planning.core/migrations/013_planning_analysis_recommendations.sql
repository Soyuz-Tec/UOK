BEGIN;

CREATE TABLE IF NOT EXISTS planning_analysis_recommendations (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    analysis_run_id TEXT NOT NULL REFERENCES planning_analysis_runs(id),
    recommendation_key VARCHAR(80) NOT NULL,
    rank INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'proposed',
    title VARCHAR(180) NOT NULL,
    explanation_json TEXT NOT NULL,
    proposal_json TEXT NOT NULL,
    preview_json TEXT NOT NULL,
    source_revision BIGINT NOT NULL,
    decision_reason VARCHAR(500),
    decided_by_user_id TEXT REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    applied_by_user_id TEXT REFERENCES users(id),
    applied_at TIMESTAMPTZ,
    applied_revision BIGINT,
    rolled_back_by_user_id TEXT REFERENCES users(id),
    rolled_back_at TIMESTAMPTZ,
    rollback_revision BIGINT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_planning_analysis_recommendation_key UNIQUE (organization_id, analysis_run_id, recommendation_key),
    CONSTRAINT ck_planning_analysis_recommendation_rank CHECK (rank >= 1 AND rank <= 100),
    CONSTRAINT ck_planning_analysis_recommendation_status CHECK (status IN ('proposed', 'approved', 'rejected', 'applied', 'rolled_back')),
    CONSTRAINT ck_planning_analysis_recommendation_source_revision CHECK (source_revision >= 1),
    CONSTRAINT ck_planning_analysis_recommendation_decision CHECK (status = 'proposed' OR (decision_reason IS NOT NULL AND decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL)),
    CONSTRAINT ck_planning_analysis_recommendation_applied CHECK (status NOT IN ('applied', 'rolled_back') OR (applied_by_user_id IS NOT NULL AND applied_at IS NOT NULL AND applied_revision IS NOT NULL)),
    CONSTRAINT ck_planning_analysis_recommendation_rollback CHECK (status <> 'rolled_back' OR (rolled_back_by_user_id IS NOT NULL AND rolled_back_at IS NOT NULL AND rollback_revision IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_planning_analysis_recommendations_org_project_status
    ON planning_analysis_recommendations (organization_id, project_id, status, rank);
CREATE INDEX IF NOT EXISTS ix_planning_analysis_recommendations_org_run_rank
    ON planning_analysis_recommendations (organization_id, analysis_run_id, rank);

CREATE OR REPLACE FUNCTION enforce_planning_recommendation_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;
    IF NOT (
        (OLD.status = 'proposed' AND NEW.status IN ('approved', 'rejected')) OR
        (OLD.status = 'approved' AND NEW.status IN ('applied', 'rejected')) OR
        (OLD.status = 'applied' AND NEW.status = 'rolled_back')
    ) THEN
        RAISE EXCEPTION 'Planning recommendation transition % to % is not allowed', OLD.status, NEW.status
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'trg_planning_recommendation_transition'
          AND tgrelid = 'planning_analysis_recommendations'::regclass
    ) THEN
        EXECUTE 'CREATE TRIGGER trg_planning_recommendation_transition
                 BEFORE UPDATE ON planning_analysis_recommendations
                 FOR EACH ROW EXECUTE FUNCTION enforce_planning_recommendation_transition()';
    END IF;
END
$$;

COMMIT;
