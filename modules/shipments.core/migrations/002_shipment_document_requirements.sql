BEGIN;

CREATE TABLE IF NOT EXISTS shipment_document_requirements (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    compliance_document_type_id VARCHAR(36) NOT NULL,
    requirement_level VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'missing',
    notes VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_shipment_document_requirements_org_shipment_type
        UNIQUE (organization_id, shipment_id, compliance_document_type_id),
    CONSTRAINT ck_shipment_document_requirements_level
        CHECK (requirement_level IN ('required', 'optional')),
    CONSTRAINT ck_shipment_document_requirements_status
        CHECK (status IN ('missing', 'received', 'waived', 'not_applicable')),
    CONSTRAINT ck_shipment_document_requirements_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_shipment_document_requirements_organization_id
    ON shipment_document_requirements (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirements_shipment_id
    ON shipment_document_requirements (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirements_org_shipment_status
    ON shipment_document_requirements (organization_id, shipment_id, status);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirements_org_type
    ON shipment_document_requirements (organization_id, compliance_document_type_id);

CREATE TABLE IF NOT EXISTS shipment_document_requirement_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    requirement_id VARCHAR(36) NOT NULL,
    compliance_document_type_id VARCHAR(36) NOT NULL,
    action VARCHAR(40) NOT NULL,
    requirement_level VARCHAR(40) NOT NULL,
    status VARCHAR(40) NOT NULL,
    notes VARCHAR(2000),
    version BIGINT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_shipment_document_requirement_history_action
        CHECK (action IN ('added', 'updated', 'status_changed', 'removed')),
    CONSTRAINT ck_shipment_document_requirement_history_level
        CHECK (requirement_level IN ('required', 'optional')),
    CONSTRAINT ck_shipment_document_requirement_history_status
        CHECK (status IN ('missing', 'received', 'waived', 'not_applicable')),
    CONSTRAINT ck_shipment_document_requirement_history_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_shipment_document_requirement_history_organization_id
    ON shipment_document_requirement_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirement_history_shipment_id
    ON shipment_document_requirement_history (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirement_history_requirement_id
    ON shipment_document_requirement_history (requirement_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirement_history_org_shipment_changed
    ON shipment_document_requirement_history (organization_id, shipment_id, changed_at);
CREATE INDEX IF NOT EXISTS ix_shipment_document_requirement_history_org_req_changed
    ON shipment_document_requirement_history (organization_id, requirement_id, changed_at);

COMMIT;
