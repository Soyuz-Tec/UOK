-- UOK-3.1.0-alpha.3
-- contacts.core module migration: operational indexes for list, review, ownership, relationship, note, and import-batch workflows.

CREATE INDEX IF NOT EXISTS ix_contacts_core_parties_org_status_review
    ON parties (organization_id, status, review_state);

CREATE INDEX IF NOT EXISTS ix_contacts_core_parties_org_display_name
    ON parties (organization_id, display_name);

CREATE INDEX IF NOT EXISTS ix_contacts_core_parties_org_owner
    ON parties (organization_id, owner_user_id);

CREATE INDEX IF NOT EXISTS ix_contacts_core_party_relationships_from
    ON party_relationships (organization_id, from_party_id);

CREATE INDEX IF NOT EXISTS ix_contacts_core_party_relationships_to
    ON party_relationships (organization_id, to_party_id);

CREATE INDEX IF NOT EXISTS ix_contacts_core_party_notes_party_created
    ON party_notes (party_id, created_at);

CREATE INDEX IF NOT EXISTS ix_contacts_core_import_batches_org_created
    ON contact_import_batches (organization_id, created_at);
