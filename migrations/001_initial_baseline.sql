-- UOK-3.1.0-alpha.2
-- Initial baseline: UOK services plus Contacts bootstrap module only.

CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memberships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_versions (
    version TEXT PRIMARY KEY,
    note TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_rules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    rule_name TEXT NOT NULL,
    domain TEXT NOT NULL,
    owner_role TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    UNIQUE (organization_id, rule_name)
);

CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    version TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'installed',
    manifest_json TEXT NOT NULL,
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS parties (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    review_state TEXT NOT NULL DEFAULT 'ready',
    owner_user_id TEXT REFERENCES users(id),
    team_id TEXT,
    visibility_scope TEXT NOT NULL DEFAULT 'organization',
    source TEXT NOT NULL DEFAULT 'manual',
    client_reference TEXT,
    sync_state TEXT NOT NULL DEFAULT 'server',
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    purged_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS party_relationships (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    from_party_id TEXT NOT NULL REFERENCES parties(id),
    to_party_id TEXT NOT NULL REFERENCES parties(id),
    relationship_type TEXT NOT NULL,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS party_notes (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    author_user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    visibility_scope TEXT NOT NULL DEFAULT 'internal',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_import_batches (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    created_by_user_id TEXT NOT NULL REFERENCES users(id),
    source_filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'completed',
    imported_count INTEGER NOT NULL DEFAULT 0,
    failed_count INTEGER NOT NULL DEFAULT 0,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_instances (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    workflow_name TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    state TEXT NOT NULL,
    history_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS command_logs (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    command_type TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    status TEXT NOT NULL,
    request_json TEXT NOT NULL DEFAULT '{}',
    response_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    sequence INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    object_type TEXT NOT NULL,
    object_id TEXT NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL
);
