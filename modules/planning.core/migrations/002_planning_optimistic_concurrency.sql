BEGIN;

ALTER TABLE planning_projects
    ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;

ALTER TABLE planning_tasks
    ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 1;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_projects_revision_positive'
          AND conrelid = 'planning_projects'::regclass
    ) THEN
        ALTER TABLE planning_projects
            ADD CONSTRAINT ck_planning_projects_revision_positive CHECK (revision >= 1);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_planning_tasks_version_positive'
          AND conrelid = 'planning_tasks'::regclass
    ) THEN
        ALTER TABLE planning_tasks
            ADD CONSTRAINT ck_planning_tasks_version_positive CHECK (version >= 1);
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_planning_core_projects_org_revision
    ON planning_projects (organization_id, id, revision);

CREATE INDEX IF NOT EXISTS ix_planning_core_tasks_org_project_version
    ON planning_tasks (organization_id, project_id, version);

COMMIT;
