BEGIN;

CREATE TABLE IF NOT EXISTS planning_task_participants (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    project_id TEXT NOT NULL REFERENCES planning_projects(id),
    task_id TEXT NOT NULL REFERENCES planning_tasks(id),
    party_id TEXT NOT NULL,
    role TEXT NOT NULL,
    source_module TEXT NOT NULL DEFAULT 'contacts.core',
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_by_actor_id TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_planning_task_participant_role UNIQUE (organization_id, task_id, party_id, role),
    CONSTRAINT ck_planning_task_participant_role
        CHECK (role IN ('owner', 'assignee', 'approver', 'consulted', 'informed', 'external_contact')),
    CONSTRAINT ck_planning_task_participant_source CHECK (source_module = 'contacts.core')
);

CREATE INDEX IF NOT EXISTS ix_planning_task_participants_party
    ON planning_task_participants (organization_id, party_id, task_id);
CREATE INDEX IF NOT EXISTS ix_planning_task_participants_task_role
    ON planning_task_participants (organization_id, project_id, task_id, role);

COMMIT;
