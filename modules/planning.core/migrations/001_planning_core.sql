CREATE TABLE IF NOT EXISTS planning_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS ix_planning_core_projects_org_status ON planning_projects (organization_id, status);

CREATE TABLE IF NOT EXISTS planning_tasks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    parent_task_id TEXT REFERENCES planning_tasks(id),
    title TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT 'task',
    status TEXT NOT NULL DEFAULT 'planned',
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    duration_days INTEGER NOT NULL DEFAULT 1,
    progress INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_planning_core_tasks_project_order ON planning_tasks (organization_id, project_id, sort_order);
CREATE INDEX IF NOT EXISTS ix_planning_core_tasks_project_status ON planning_tasks (organization_id, project_id, status);

CREATE TABLE IF NOT EXISTS planning_task_dependencies (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    predecessor_task_id TEXT NOT NULL REFERENCES planning_tasks(id),
    successor_task_id TEXT NOT NULL REFERENCES planning_tasks(id),
    dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
    lag_days INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, project_id, predecessor_task_id, successor_task_id)
);

CREATE INDEX IF NOT EXISTS ix_planning_core_dependencies_successor ON planning_task_dependencies (organization_id, successor_task_id);

CREATE TABLE IF NOT EXISTS planning_calendars (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    name TEXT NOT NULL,
    working_days_json TEXT NOT NULL DEFAULT '[1,2,3,4,5]',
    holidays_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS planning_resources (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS planning_assignments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    task_id TEXT NOT NULL REFERENCES planning_tasks(id),
    resource_id TEXT NOT NULL REFERENCES planning_resources(id),
    allocation_percent INTEGER NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS planning_baselines (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    name TEXT NOT NULL,
    snapshot_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS planning_schedule_events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);
