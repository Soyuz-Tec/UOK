BEGIN;

CREATE TABLE IF NOT EXISTS planning_task_requirements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    task_id TEXT NOT NULL REFERENCES planning_tasks(id),
    requirement_type TEXT NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'missing',
    required BOOLEAN NOT NULL DEFAULT TRUE,
    target_link_id TEXT REFERENCES planning_links(id),
    due_at TIMESTAMPTZ,
    decision_reason TEXT,
    decided_by_actor_id TEXT,
    decided_at TIMESTAMPTZ,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_by_actor_id TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_planning_requirement_type
        CHECK (requirement_type IN ('evidence', 'approval', 'compliance', 'finance', 'shipment', 'document', 'custom')),
    CONSTRAINT ck_planning_requirement_state
        CHECK (state IN ('missing', 'submitted', 'under_review', 'satisfied', 'rejected', 'waived')),
    CONSTRAINT ck_planning_requirement_decision
        CHECK (state NOT IN ('satisfied', 'rejected', 'waived') OR (decided_by_actor_id IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ix_planning_requirements_task_state
    ON planning_task_requirements (organization_id, project_id, task_id, state);
CREATE INDEX IF NOT EXISTS ix_planning_requirements_due
    ON planning_task_requirements (organization_id, project_id, required, due_at);

COMMIT;
