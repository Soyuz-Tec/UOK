BEGIN;

CREATE TABLE IF NOT EXISTS product_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    code VARCHAR(80) NOT NULL,
    canonical_name VARCHAR(180) NOT NULL,
    category VARCHAR(120),
    grade VARCHAR(120),
    specification TEXT,
    base_unit_code VARCHAR(40),
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    version BIGINT NOT NULL DEFAULT 1,
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    CONSTRAINT uq_product_definitions_org_code UNIQUE (organization_id, code),
    CONSTRAINT ck_product_definitions_status CHECK (status IN ('active', 'archived')),
    CONSTRAINT ck_product_definitions_version_positive CHECK (version >= 1)
);

CREATE INDEX IF NOT EXISTS ix_product_definitions_organization_id
    ON product_definitions (organization_id);
CREATE INDEX IF NOT EXISTS ix_product_definitions_org_status_name
    ON product_definitions (organization_id, status, canonical_name);
CREATE INDEX IF NOT EXISTS ix_product_definitions_org_category_grade
    ON product_definitions (organization_id, category, grade);

CREATE TABLE IF NOT EXISTS product_name_history (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    product_definition_id TEXT NOT NULL REFERENCES product_definitions(id),
    previous_name VARCHAR(180) NOT NULL,
    new_name VARCHAR(180) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    changed_by_user_id TEXT NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_product_name_history_organization_id
    ON product_name_history (organization_id);
CREATE INDEX IF NOT EXISTS ix_product_name_history_product_definition_id
    ON product_name_history (product_definition_id);
CREATE INDEX IF NOT EXISTS ix_product_name_history_org_product_changed
    ON product_name_history (organization_id, product_definition_id, changed_at);

COMMIT;
