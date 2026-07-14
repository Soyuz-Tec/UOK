-- UOK-3.1.0-alpha.3
-- contacts.core module migration: governed contact facts, authorization,
-- privacy evidence, durable workflows, interoperability, and extensibility.

BEGIN;

CREATE TABLE IF NOT EXISTS contact_teams (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS contact_team_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    team_id TEXT NOT NULL REFERENCES contact_teams(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member',
    status TEXT NOT NULL DEFAULT 'active',
    added_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, team_id, user_id)
);

CREATE TABLE IF NOT EXISTS party_facts (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    fact_type TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'work',
    value_text TEXT NOT NULL,
    normalized_value VARCHAR(512) NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}',
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    source TEXT NOT NULL DEFAULT 'manual',
    confidence TEXT NOT NULL DEFAULT 'unknown',
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, party_id, fact_type, label, normalized_value)
);

CREATE TABLE IF NOT EXISTS contact_consent_records (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    purpose TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    legal_basis TEXT NOT NULL DEFAULT 'unspecified',
    allowed_use TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    evidence_json TEXT NOT NULL DEFAULT '{}',
    effective_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ,
    recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_import_rows (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    batch_id TEXT NOT NULL REFERENCES contact_import_batches(id),
    row_number INTEGER NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    requested_operation TEXT NOT NULL DEFAULT 'create',
    applied_operation TEXT NOT NULL DEFAULT 'none',
    status TEXT NOT NULL DEFAULT 'pending',
    party_id TEXT REFERENCES parties(id),
    matched_party_id TEXT REFERENCES parties(id),
    error_code TEXT,
    error_message TEXT NOT NULL DEFAULT '',
    input_json TEXT NOT NULL DEFAULT '{}',
    result_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, batch_id, row_number)
);

CREATE TABLE IF NOT EXISTS contact_duplicate_candidates (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    left_party_id TEXT NOT NULL REFERENCES parties(id),
    right_party_id TEXT NOT NULL REFERENCES parties(id),
    score INTEGER NOT NULL,
    reasons_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'open',
    resolved_by_user_id TEXT REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, left_party_id, right_party_id),
    CHECK (left_party_id <> right_party_id)
);

CREATE TABLE IF NOT EXISTS contact_saved_views (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    visibility_scope TEXT NOT NULL DEFAULT 'personal',
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    query_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, owner_user_id, name)
);

CREATE TABLE IF NOT EXISTS contact_activities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    actor_user_id TEXT REFERENCES users(id),
    activity_type TEXT NOT NULL,
    object_type TEXT NOT NULL DEFAULT 'Party',
    object_id TEXT NOT NULL,
    summary TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_external_identities (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    provider TEXT NOT NULL,
    external_id TEXT NOT NULL,
    sync_state TEXT NOT NULL DEFAULT 'linked',
    conflict_state TEXT NOT NULL DEFAULT 'none',
    etag TEXT,
    sync_cursor TEXT,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, provider, external_id)
);

CREATE TABLE IF NOT EXISTS contact_custom_field_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    field_key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_type TEXT NOT NULL,
    applies_to TEXT NOT NULL DEFAULT 'all',
    required BOOLEAN NOT NULL DEFAULT FALSE,
    options_json TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, field_key)
);

CREATE TABLE IF NOT EXISTS party_custom_field_values (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    field_definition_id TEXT NOT NULL REFERENCES contact_custom_field_definitions(id),
    value_json TEXT NOT NULL DEFAULT 'null',
    updated_by_user_id TEXT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, party_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS ix_contacts_core_teams_org_status ON contact_teams (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_team_members_user ON contact_team_members (organization_id, user_id, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_team_members_team ON contact_team_members (organization_id, team_id, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_party_facts_party_type ON party_facts (organization_id, party_id, fact_type);
CREATE INDEX IF NOT EXISTS ix_contacts_core_party_facts_normalized ON party_facts (organization_id, fact_type, normalized_value);
CREATE INDEX IF NOT EXISTS ix_contacts_core_consent_party_created ON contact_consent_records (organization_id, party_id, created_at);
CREATE INDEX IF NOT EXISTS ix_contacts_core_consent_policy ON contact_consent_records (organization_id, purpose, channel, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_import_rows_batch_status ON contact_import_rows (organization_id, batch_id, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_import_rows_checksum ON contact_import_rows (organization_id, checksum);
CREATE INDEX IF NOT EXISTS ix_contacts_core_duplicate_candidates_queue ON contact_duplicate_candidates (organization_id, status, score);
CREATE INDEX IF NOT EXISTS ix_contacts_core_saved_views_owner ON contact_saved_views (organization_id, owner_user_id, is_pinned);
CREATE INDEX IF NOT EXISTS ix_contacts_core_activity_party_time ON contact_activities (organization_id, party_id, occurred_at);
CREATE INDEX IF NOT EXISTS ix_contacts_core_external_party ON contact_external_identities (organization_id, party_id, provider);
CREATE INDEX IF NOT EXISTS ix_contacts_core_custom_fields_status ON contact_custom_field_definitions (organization_id, status);
CREATE INDEX IF NOT EXISTS ix_contacts_core_custom_values_party ON party_custom_field_values (organization_id, party_id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_contacts_core_relationship_not_self'
          AND conrelid = 'party_relationships'::regclass
    ) THEN
        ALTER TABLE party_relationships
            ADD CONSTRAINT ck_contacts_core_relationship_not_self
            CHECK (from_party_id <> to_party_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_contacts_core_relationship_identity'
          AND conrelid = 'party_relationships'::regclass
    ) THEN
        ALTER TABLE party_relationships
            ADD CONSTRAINT uq_contacts_core_relationship_identity
            UNIQUE (organization_id, from_party_id, to_party_id, relationship_type);
    END IF;
END
$$;

COMMIT;
