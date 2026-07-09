-- UOK-3.1.0-alpha.3
-- contacts.core module migration: persistent manual contact groups and memberships.

CREATE TABLE IF NOT EXISTS contact_groups (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'manual',
    visibility_scope TEXT NOT NULL DEFAULT 'organization',
    owner_user_id TEXT REFERENCES users(id),
    team_id TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    sort_order INTEGER NOT NULL DEFAULT 0,
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ,
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS contact_group_members (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES organizations(id),
    group_id TEXT NOT NULL REFERENCES contact_groups(id),
    party_id TEXT NOT NULL REFERENCES parties(id),
    added_by_user_id TEXT NOT NULL REFERENCES users(id),
    attrs_json TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (organization_id, group_id, party_id)
);

CREATE INDEX IF NOT EXISTS ix_contacts_core_contact_groups_org_status
    ON contact_groups (organization_id, status);

CREATE INDEX IF NOT EXISTS ix_contacts_core_contact_groups_org_owner
    ON contact_groups (organization_id, owner_user_id);

CREATE INDEX IF NOT EXISTS ix_contacts_core_group_members_group
    ON contact_group_members (organization_id, group_id);

CREATE INDEX IF NOT EXISTS ix_contacts_core_group_members_party
    ON contact_group_members (organization_id, party_id);
