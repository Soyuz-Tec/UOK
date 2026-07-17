BEGIN;

CREATE TABLE IF NOT EXISTS route_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    code VARCHAR(80) NOT NULL,
    canonical_name VARCHAR(180) NOT NULL,
    mode_hint VARCHAR(40),
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_route_definitions_org_code UNIQUE (organization_id, code),
    CONSTRAINT ck_route_definitions_mode_hint
        CHECK (mode_hint IS NULL OR mode_hint IN ('sea', 'road', 'rail', 'air', 'multimodal')),
    CONSTRAINT ck_route_definitions_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT ck_route_definitions_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_route_definitions_organization_id
    ON route_definitions (organization_id);
CREATE INDEX IF NOT EXISTS ix_route_definitions_org_status_name
    ON route_definitions (organization_id, status, canonical_name);
CREATE INDEX IF NOT EXISTS ix_route_definitions_org_mode
    ON route_definitions (organization_id, mode_hint);

CREATE TABLE IF NOT EXISTS route_stops (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    route_definition_id TEXT NOT NULL REFERENCES route_definitions(id),
    sequence INTEGER NOT NULL,
    stop_role VARCHAR(40) NOT NULL,
    location_definition_id VARCHAR(36) NOT NULL,
    CONSTRAINT uq_route_stops_org_route_sequence
        UNIQUE (organization_id, route_definition_id, sequence),
    CONSTRAINT uq_route_stops_org_route_location
        UNIQUE (organization_id, route_definition_id, location_definition_id),
    CONSTRAINT ck_route_stops_sequence CHECK (sequence >= 0 AND sequence <= 9),
    CONSTRAINT ck_route_stops_role CHECK (stop_role IN ('origin', 'waypoint', 'destination'))
);

CREATE INDEX IF NOT EXISTS ix_route_stops_organization_id
    ON route_stops (organization_id);
CREATE INDEX IF NOT EXISTS ix_route_stops_route_definition_id
    ON route_stops (route_definition_id);
CREATE INDEX IF NOT EXISTS ix_route_stops_org_route_sequence
    ON route_stops (organization_id, route_definition_id, sequence);
CREATE INDEX IF NOT EXISTS ix_route_stops_org_location
    ON route_stops (organization_id, location_definition_id);

CREATE TABLE IF NOT EXISTS route_name_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    route_definition_id TEXT NOT NULL REFERENCES route_definitions(id),
    previous_name VARCHAR(180) NOT NULL,
    new_name VARCHAR(180) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_route_name_history_organization_id
    ON route_name_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_route_name_history_route_definition_id
    ON route_name_history (route_definition_id);
CREATE INDEX IF NOT EXISTS ix_route_name_history_org_route_changed
    ON route_name_history (organization_id, route_definition_id, changed_at);

COMMIT;
