BEGIN;

CREATE TABLE IF NOT EXISTS shipment_document_instances (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    compliance_document_type_id VARCHAR(36) NOT NULL,
    requirement_id TEXT REFERENCES shipment_document_requirements(id),
    document_number VARCHAR(160) NOT NULL,
    issuing_party_name VARCHAR(240),
    issued_on DATE,
    expires_on DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    notes VARCHAR(2000),
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_shipment_document_instances_status
        CHECK (status IN ('draft', 'recorded', 'verified', 'rejected', 'superseded')),
    CONSTRAINT ck_shipment_document_instances_version_positive CHECK (version >= 1),
    CONSTRAINT ck_shipment_document_instances_date_order
        CHECK (issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on)
);

CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_organization_id
    ON shipment_document_instances (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_shipment_id
    ON shipment_document_instances (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_requirement_id
    ON shipment_document_instances (requirement_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_org_shipment_status
    ON shipment_document_instances (organization_id, shipment_id, status);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_org_type
    ON shipment_document_instances (organization_id, compliance_document_type_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instances_org_requirement
    ON shipment_document_instances (organization_id, requirement_id);

CREATE TABLE IF NOT EXISTS shipment_document_instance_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    instance_id VARCHAR(36) NOT NULL,
    compliance_document_type_id VARCHAR(36) NOT NULL,
    requirement_id VARCHAR(36),
    document_number VARCHAR(160) NOT NULL,
    issuing_party_name VARCHAR(240),
    issued_on DATE,
    expires_on DATE,
    status VARCHAR(40) NOT NULL,
    notes VARCHAR(2000),
    action VARCHAR(40) NOT NULL,
    version BIGINT NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_shipment_document_instance_history_status
        CHECK (status IN ('draft', 'recorded', 'verified', 'rejected', 'superseded')),
    CONSTRAINT ck_shipment_document_instance_history_action
        CHECK (action IN ('created', 'updated', 'status_changed')),
    CONSTRAINT ck_shipment_document_instance_history_version_positive CHECK (version >= 1),
    CONSTRAINT ck_shipment_document_instance_history_date_order
        CHECK (issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on)
);

CREATE INDEX IF NOT EXISTS ix_shipment_document_instance_history_organization_id
    ON shipment_document_instance_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instance_history_shipment_id
    ON shipment_document_instance_history (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instance_history_instance_id
    ON shipment_document_instance_history (instance_id);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instance_history_org_shipment_changed
    ON shipment_document_instance_history (organization_id, shipment_id, changed_at);
CREATE INDEX IF NOT EXISTS ix_shipment_document_instance_history_org_instance_changed
    ON shipment_document_instance_history (organization_id, instance_id, changed_at);

COMMIT;
