BEGIN;

CREATE TABLE IF NOT EXISTS communication_threads (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open',
    context_type TEXT NOT NULL DEFAULT 'general',
    context_id TEXT,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT ck_communication_thread_status CHECK (status IN ('open', 'closed', 'archived'))
);

CREATE INDEX IF NOT EXISTS ix_communication_threads_org_updated
    ON communication_threads (organization_id, updated_at);
CREATE INDEX IF NOT EXISTS ix_communication_threads_org_context
    ON communication_threads (organization_id, context_type, context_id);

COMMIT;
