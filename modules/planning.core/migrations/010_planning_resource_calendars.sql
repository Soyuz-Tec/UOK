BEGIN;

CREATE TABLE IF NOT EXISTS planning_resource_calendars (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    resource_id TEXT NOT NULL REFERENCES planning_resources(id),
    name TEXT NOT NULL DEFAULT 'Resource capacity',
    working_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    holidays_json TEXT NOT NULL DEFAULT '[]',
    default_capacity_percent INTEGER NOT NULL DEFAULT 100,
    capacity_exceptions_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_planning_resource_calendars_org_resource UNIQUE (organization_id, resource_id),
    CONSTRAINT ck_planning_resource_calendar_capacity_range
        CHECK (default_capacity_percent >= 0 AND default_capacity_percent <= 300)
);

CREATE INDEX IF NOT EXISTS ix_planning_resource_calendars_org_project_resource
    ON planning_resource_calendars (organization_id, project_id, resource_id);

COMMIT;
