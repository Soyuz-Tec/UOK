BEGIN;

CREATE TABLE IF NOT EXISTS agent_runbooks (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name VARCHAR(160) NOT NULL,
    description TEXT,
    goal TEXT NOT NULL,
    target_module VARCHAR(120) NOT NULL,
    allowed_tools_json TEXT NOT NULL DEFAULT '[]',
    allowed_commands_json TEXT NOT NULL DEFAULT '[]',
    allowed_data_scopes_json TEXT NOT NULL DEFAULT '[]',
    risk_level VARCHAR(20) NOT NULL,
    approval_policy VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_agent_runbooks_org_name UNIQUE (organization_id, name),
    CONSTRAINT ck_agent_runbooks_risk CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT ck_agent_runbooks_approval CHECK (approval_policy IN ('always', 'risk_based')),
    CONSTRAINT ck_agent_runbooks_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT ck_agent_runbooks_version CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_agent_runbooks_organization_id ON agent_runbooks (organization_id);
CREATE INDEX IF NOT EXISTS ix_agent_runbooks_org_status_name ON agent_runbooks (organization_id, status, name);

CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    runbook_id TEXT NOT NULL REFERENCES agent_runbooks(id),
    runbook_version BIGINT NOT NULL,
    target_module VARCHAR(120) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,
    approval_policy VARCHAR(20) NOT NULL,
    allowed_tools_json TEXT NOT NULL,
    allowed_commands_json TEXT NOT NULL,
    allowed_data_scopes_json TEXT NOT NULL,
    input_json TEXT NOT NULL DEFAULT '{}',
    plan_kind VARCHAR(20),
    plan_json TEXT NOT NULL DEFAULT '{}',
    plan_sha256 VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'draft',
    approval_reason VARCHAR(500),
    version BIGINT NOT NULL DEFAULT 1,
    requested_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    decided_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    CONSTRAINT ck_agent_runs_risk CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT ck_agent_runs_approval CHECK (approval_policy IN ('always', 'risk_based')),
    CONSTRAINT ck_agent_runs_status CHECK (
        status IN ('draft', 'awaiting_approval', 'approved', 'revision_requested', 'rejected', 'escalated', 'completed', 'failed')
    ),
    CONSTRAINT ck_agent_runs_version CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_agent_runs_organization_id ON agent_runs (organization_id);
CREATE INDEX IF NOT EXISTS ix_agent_runs_runbook_id ON agent_runs (runbook_id);
CREATE INDEX IF NOT EXISTS ix_agent_runs_org_status_created ON agent_runs (organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS ix_agent_runs_org_runbook_created ON agent_runs (organization_id, runbook_id, created_at);

CREATE TABLE IF NOT EXISTS agent_approvals (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    run_id TEXT NOT NULL REFERENCES agent_runs(id),
    decision VARCHAR(32) NOT NULL,
    reason TEXT NOT NULL,
    decided_by_user_id TEXT NOT NULL REFERENCES users(id),
    decided_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_agent_approvals_decision CHECK (
        decision IN ('approved', 'rejected', 'revision_requested', 'escalated', 'overridden')
    )
);

CREATE INDEX IF NOT EXISTS ix_agent_approvals_organization_id ON agent_approvals (organization_id);
CREATE INDEX IF NOT EXISTS ix_agent_approvals_run_id ON agent_approvals (run_id);
CREATE INDEX IF NOT EXISTS ix_agent_approvals_org_run_decided ON agent_approvals (organization_id, run_id, decided_at);

CREATE TABLE IF NOT EXISTS agent_evidence (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    run_id TEXT NOT NULL REFERENCES agent_runs(id),
    evidence_type VARCHAR(32) NOT NULL,
    summary VARCHAR(500) NOT NULL,
    content_json TEXT NOT NULL,
    content_sha256 VARCHAR(64) NOT NULL,
    recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_agent_evidence_type CHECK (
        evidence_type IN ('input', 'plan', 'decision', 'override', 'outcome', 'failure')
    )
);

CREATE INDEX IF NOT EXISTS ix_agent_evidence_organization_id ON agent_evidence (organization_id);
CREATE INDEX IF NOT EXISTS ix_agent_evidence_run_id ON agent_evidence (run_id);
CREATE INDEX IF NOT EXISTS ix_agent_evidence_org_run_created ON agent_evidence (organization_id, run_id, created_at);

COMMIT;
