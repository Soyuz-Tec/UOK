BEGIN;

-- Apply only while Planning writers are quiesced. Older application instances do
-- not populate the new non-null finish columns and are not rolling-compatible.
LOCK TABLE planning_projects, planning_tasks IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM planning_projects
        WHERE status NOT IN ('draft', 'active', 'on_hold', 'completed', 'archived', 'purged')
    ) THEN
        RAISE EXCEPTION 'Planning project status preflight failed before lifecycle constraints';
    END IF;
    IF EXISTS (
        SELECT 1 FROM planning_tasks
        WHERE status NOT IN ('planned', 'in_progress', 'blocked', 'complete', 'deleted')
    ) THEN
        RAISE EXCEPTION 'Planning task status preflight failed before lifecycle constraints';
    END IF;
END
$$;

ALTER TABLE planning_projects
    ADD COLUMN IF NOT EXISTS target_finish_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS calculated_finish_at TIMESTAMPTZ;

UPDATE planning_projects project
SET target_finish_at = COALESCE(project.target_finish_at, project.end_at),
    calculated_finish_at = COALESCE(
        project.calculated_finish_at,
        (
            SELECT MAX(task.end_at)
            FROM planning_tasks task
            WHERE task.organization_id = project.organization_id
              AND task.project_id = project.id
              AND task.status <> 'deleted'
        ),
        project.start_at
    )
WHERE project.target_finish_at IS NULL
   OR project.calculated_finish_at IS NULL;

ALTER TABLE planning_projects
    ALTER COLUMN target_finish_at SET NOT NULL,
    ALTER COLUMN calculated_finish_at SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_projects_target_finish_order'
          AND conrelid = 'planning_projects'::regclass
    ) THEN
        ALTER TABLE planning_projects
            ADD CONSTRAINT ck_planning_projects_target_finish_order
            CHECK (target_finish_at >= start_at);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_projects_status'
          AND conrelid = 'planning_projects'::regclass
    ) THEN
        ALTER TABLE planning_projects
            ADD CONSTRAINT ck_planning_projects_status
            CHECK (status IN ('draft', 'active', 'on_hold', 'completed', 'archived', 'purged'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_tasks_status'
          AND conrelid = 'planning_tasks'::regclass
    ) THEN
        ALTER TABLE planning_tasks
            ADD CONSTRAINT ck_planning_tasks_status
            CHECK (status IN ('planned', 'in_progress', 'blocked', 'complete', 'deleted'));
    END IF;
END
$$;

COMMIT;
