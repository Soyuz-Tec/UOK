BEGIN;

ALTER TABLE planning_projects
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE planning_tasks
    ADD COLUMN IF NOT EXISTS forecast_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS forecast_end_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS actual_end_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_projects_timezone_nonempty' AND conrelid = 'planning_projects'::regclass) THEN
        ALTER TABLE planning_projects ADD CONSTRAINT ck_planning_projects_timezone_nonempty
            CHECK (length(BTRIM(timezone)) BETWEEN 1 AND 80);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_forecast_order' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_forecast_order
            CHECK (forecast_start_at IS NULL OR forecast_end_at IS NULL OR forecast_end_at >= forecast_start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_actual_start_required' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_actual_start_required
            CHECK (actual_end_at IS NULL OR actual_start_at IS NOT NULL);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_actual_order' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_actual_order
            CHECK (actual_start_at IS NULL OR actual_end_at IS NULL OR actual_end_at >= actual_start_at);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_planning_core_tasks_org_project_deadline
    ON planning_tasks (organization_id, project_id, deadline_at);

COMMIT;
