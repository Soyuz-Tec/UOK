BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_projects_date_order' AND conrelid = 'planning_projects'::regclass) THEN
        ALTER TABLE planning_projects ADD CONSTRAINT ck_planning_projects_date_order CHECK (end_at >= start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_date_order' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_date_order CHECK (end_at >= start_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_duration_nonnegative' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_duration_nonnegative CHECK (duration_days >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_progress_range' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_progress_range CHECK (progress >= 0 AND progress <= 100);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_sort_order_nonnegative' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_sort_order_nonnegative CHECK (sort_order >= 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_type' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_type CHECK (task_type IN ('task', 'summary', 'milestone'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_tasks_scheduling_mode' AND conrelid = 'planning_tasks'::regclass) THEN
        ALTER TABLE planning_tasks ADD CONSTRAINT ck_planning_tasks_scheduling_mode
            CHECK (COALESCE(NULLIF(BTRIM(attrs_json::jsonb ->> 'scheduling_mode'), ''), 'auto') IN ('auto', 'manual'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_dependencies_distinct_tasks' AND conrelid = 'planning_task_dependencies'::regclass) THEN
        ALTER TABLE planning_task_dependencies ADD CONSTRAINT ck_planning_dependencies_distinct_tasks CHECK (predecessor_task_id <> successor_task_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_dependencies_type' AND conrelid = 'planning_task_dependencies'::regclass) THEN
        ALTER TABLE planning_task_dependencies ADD CONSTRAINT ck_planning_dependencies_type
            CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_dependencies_lag_range' AND conrelid = 'planning_task_dependencies'::regclass) THEN
        ALTER TABLE planning_task_dependencies ADD CONSTRAINT ck_planning_dependencies_lag_range CHECK (lag_days >= -30 AND lag_days <= 30);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_planning_assignments_allocation_range' AND conrelid = 'planning_assignments'::regclass) THEN
        ALTER TABLE planning_assignments ADD CONSTRAINT ck_planning_assignments_allocation_range CHECK (allocation_percent >= 1 AND allocation_percent <= 300);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_planning_calendars_org_project' AND conrelid = 'planning_calendars'::regclass) THEN
        ALTER TABLE planning_calendars ADD CONSTRAINT uq_planning_calendars_org_project UNIQUE (organization_id, project_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_planning_assignments_org_task_resource' AND conrelid = 'planning_assignments'::regclass) THEN
        ALTER TABLE planning_assignments ADD CONSTRAINT uq_planning_assignments_org_task_resource UNIQUE (organization_id, task_id, resource_id);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_planning_core_tasks_org_project_parent
    ON planning_tasks (organization_id, project_id, parent_task_id);
CREATE INDEX IF NOT EXISTS ix_planning_core_dependencies_project_predecessor
    ON planning_task_dependencies (organization_id, project_id, predecessor_task_id);
CREATE INDEX IF NOT EXISTS ix_planning_core_dependencies_project_successor
    ON planning_task_dependencies (organization_id, project_id, successor_task_id);
CREATE INDEX IF NOT EXISTS ix_planning_core_assignments_org_resource_task
    ON planning_assignments (organization_id, resource_id, task_id);

COMMIT;
