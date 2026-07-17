BEGIN;

CREATE TABLE IF NOT EXISTS location_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    code VARCHAR(80) NOT NULL,
    canonical_name VARCHAR(180) NOT NULL,
    location_type VARCHAR(40) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_location_definitions_org_code UNIQUE (organization_id, code),
    CONSTRAINT ck_location_definitions_type CHECK (location_type IN ('port', 'warehouse', 'city', 'region')),
    CONSTRAINT ck_location_definitions_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT ck_location_definitions_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_location_definitions_organization_id
    ON location_definitions (organization_id);
CREATE INDEX IF NOT EXISTS ix_location_definitions_org_status_name
    ON location_definitions (organization_id, status, canonical_name);
CREATE INDEX IF NOT EXISTS ix_location_definitions_org_type_country
    ON location_definitions (organization_id, location_type, country_code);

CREATE TABLE IF NOT EXISTS location_name_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    location_definition_id TEXT NOT NULL REFERENCES location_definitions(id),
    previous_name VARCHAR(180) NOT NULL,
    new_name VARCHAR(180) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_location_name_history_organization_id
    ON location_name_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_location_name_history_location_definition_id
    ON location_name_history (location_definition_id);
CREATE INDEX IF NOT EXISTS ix_location_name_history_org_location_changed
    ON location_name_history (organization_id, location_definition_id, changed_at);

COMMIT;
