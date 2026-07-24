BEGIN;

CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    code VARCHAR(80) NOT NULL,
    shipper_party_id VARCHAR(36) NOT NULL,
    consignee_party_id VARCHAR(36) NOT NULL,
    origin_location_id VARCHAR(36) NOT NULL,
    destination_location_id VARCHAR(36) NOT NULL,
    route_definition_id VARCHAR(36),
    planned_departure_on DATE,
    planned_arrival_on DATE,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_shipments_org_code UNIQUE (organization_id, code),
    CONSTRAINT ck_shipments_status
        CHECK (status IN ('draft', 'planned', 'in_transit', 'arrived', 'closed', 'cancelled')),
    CONSTRAINT ck_shipments_version_positive CHECK (version >= 1),
    CONSTRAINT ck_shipments_distinct_endpoints CHECK (origin_location_id <> destination_location_id),
    CONSTRAINT ck_shipments_planned_date_order
        CHECK (
            planned_departure_on IS NULL
            OR planned_arrival_on IS NULL
            OR planned_arrival_on >= planned_departure_on
        )
);

CREATE INDEX IF NOT EXISTS ix_shipments_organization_id
    ON shipments (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipments_org_status_code
    ON shipments (organization_id, status, code);
CREATE INDEX IF NOT EXISTS ix_shipments_org_planned_departure
    ON shipments (organization_id, planned_departure_on);
CREATE INDEX IF NOT EXISTS ix_shipments_org_route
    ON shipments (organization_id, route_definition_id);
CREATE INDEX IF NOT EXISTS ix_shipments_org_shipper
    ON shipments (organization_id, shipper_party_id);
CREATE INDEX IF NOT EXISTS ix_shipments_org_consignee
    ON shipments (organization_id, consignee_party_id);

CREATE TABLE IF NOT EXISTS shipment_status_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    shipment_id TEXT NOT NULL REFERENCES shipments(id),
    previous_status VARCHAR(40) NOT NULL,
    new_status VARCHAR(40) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    version BIGINT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_shipment_status_history_version CHECK (version >= 2)
);

CREATE INDEX IF NOT EXISTS ix_shipment_status_history_organization_id
    ON shipment_status_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_shipment_status_history_shipment_id
    ON shipment_status_history (shipment_id);
CREATE INDEX IF NOT EXISTS ix_shipment_status_history_org_shipment_changed
    ON shipment_status_history (organization_id, shipment_id, changed_at);

COMMIT;
