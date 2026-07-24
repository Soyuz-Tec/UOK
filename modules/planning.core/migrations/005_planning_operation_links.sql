-- Additive Planning-owned typed references to optional cross-module targets.
-- Target modules retain lifecycle, authorization, privacy, and retention ownership.

CREATE TABLE IF NOT EXISTS planning_links (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    task_id TEXT REFERENCES planning_tasks(id),
    scope_type TEXT NOT NULL,
    relationship TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_id TEXT NOT NULL,
    resolver TEXT NOT NULL,
    resolver_version TEXT NOT NULL DEFAULT '1',
    blocking BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_status TEXT NOT NULL DEFAULT 'unavailable',
    status_summary TEXT,
    provenance_json TEXT NOT NULL DEFAULT '{}',
    created_by_actor_id TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    last_resolved_at TIMESTAMPTZ,
    CONSTRAINT uq_planning_links_identity UNIQUE NULLS NOT DISTINCT (
        organization_id, project_id, scope_type, task_id,
        relationship, target_kind, target_id, resolver
    ),
    CONSTRAINT ck_planning_links_scope CHECK (
        (scope_type = 'project' AND task_id IS NULL)
        OR (scope_type = 'task' AND task_id IS NOT NULL)
    ),
    CONSTRAINT ck_planning_links_relationship CHECK (relationship IN (
        'implements', 'blocks_on', 'requires', 'proves', 'owned_by',
        'moves', 'occurs_at', 'discussed_in', 'publishes_to'
    )),
    CONSTRAINT ck_planning_links_target_kind CHECK (target_kind IN (
        'operation', 'gate', 'evidence', 'party', 'shipment', 'document',
        'location', 'asset', 'agreement', 'communication_thread', 'calendar_event'
    )),
    CONSTRAINT ck_planning_links_resolution_status CHECK (
        resolution_status IN ('ready', 'unavailable', 'denied', 'missing')
    )
);

CREATE INDEX IF NOT EXISTS ix_planning_links_project_task
    ON planning_links (organization_id, project_id, task_id);

CREATE INDEX IF NOT EXISTS ix_planning_links_target
    ON planning_links (organization_id, target_kind, target_id, resolver);

CREATE INDEX IF NOT EXISTS ix_planning_links_blocking
    ON planning_links (organization_id, project_id, blocking, resolution_status);
