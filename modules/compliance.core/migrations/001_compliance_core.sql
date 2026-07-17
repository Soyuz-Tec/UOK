BEGIN;

CREATE TABLE IF NOT EXISTS compliance_document_types (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    code VARCHAR(80) NOT NULL,
    canonical_name VARCHAR(180) NOT NULL,
    description VARCHAR(2000),
    category VARCHAR(120),
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_compliance_document_types_org_code UNIQUE (organization_id, code),
    CONSTRAINT ck_compliance_document_types_status
        CHECK (status IN ('active', 'inactive', 'archived')),
    CONSTRAINT ck_compliance_document_types_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_compliance_document_types_organization_id
    ON compliance_document_types (organization_id);
CREATE INDEX IF NOT EXISTS ix_compliance_document_types_org_status_name
    ON compliance_document_types (organization_id, status, canonical_name);
CREATE INDEX IF NOT EXISTS ix_compliance_document_types_org_category
    ON compliance_document_types (organization_id, category);

CREATE TABLE IF NOT EXISTS compliance_document_type_name_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    compliance_document_type_id TEXT NOT NULL REFERENCES compliance_document_types(id),
    previous_name VARCHAR(180) NOT NULL,
    new_name VARCHAR(180) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_compliance_document_type_name_history_organization_id
    ON compliance_document_type_name_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_compliance_document_type_name_history_type_id
    ON compliance_document_type_name_history (compliance_document_type_id);
CREATE INDEX IF NOT EXISTS ix_compliance_document_type_name_history_org_type_changed
    ON compliance_document_type_name_history (
        organization_id,
        compliance_document_type_id,
        changed_at
    );

COMMIT;
