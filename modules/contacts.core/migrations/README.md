# Contacts Core Migrations

Contacts table ownership is declared in `modules/contacts.core/manifest.yaml` and validated through the migration discipline gate.

`001_contacts_core_operational_indexes.sql` is the first module-owned migration. It keeps Contacts list, search, review queue, ownership, relationship, note, and import-batch workflows indexed without adding product, cargo, or CRM-specific tables to the UOK baseline.

`002_contacts_core_groups.sql` adds module-owned persistent contact groups and group memberships. It keeps user-managed grouping inside `contacts.core` so the UOK baseline remains module-neutral.

`003_contacts_core_system_of_record.sql` adds the governed Contacts system-of-record tables for contact teams and memberships, first-class party facts, consent evidence, durable import rows, persisted duplicate candidates, actor-owned saved views, contact activity, provider-neutral external identities, custom-field definitions, and party custom-field values. It also adds organization-scoped indexes and relationship integrity constraints. The migration is additive and keeps the legacy flat fact projection available during compatibility rollout.

`004_contacts_core_merge_privacy.sql` sanitizes legacy `Party.attrs_json` merge-history entries to the public metadata allowlist (`merge_id`, `primary_party_id`, `duplicate_party_id`, `merged_at`, and `rolled_back_at`). Full rollback snapshots created by current code remain in the internal, purge-scrubbed event ledger. Legacy snapshots that existed only inside party attributes are intentionally destroyed: their rollback evidence cannot be recovered after this migration, because retaining pre-merge names, addresses, contact facts, notes, or governed-record payloads would preserve an ordinary-reader PII exposure. The migration also replaces the historical raw-`attrs_json` PostgreSQL search index with an explicit searchable contact-field allowlist, so `merge_history` and other internal metadata cannot enter the full-text vector.

The Contacts search index is PostgreSQL-oriented and supports the runtime full-text search path. The application keeps a Python search fallback for non-Postgres local test workflows.

## Rollout And Rollback

1. Create and verify a PostgreSQL custom-format backup before applying the migration in a persistent environment.
2. Apply module migrations through the normal UOK module migration gate; do not run individual SQL files ad hoc against shared data.
3. Run model-registry, physical-boundary, migration-scope, focused Contacts, candidate, and PostgreSQL smoke checks.
4. If application behavior must roll back, disable the new controls and stop new writes while retaining the additive tables and evidence. The legacy primary-fact projection supports the previous read surface.
5. Do not use a down migration that drops governance, consent, import, duplicate, activity, identity, or custom-field evidence. Use the guarded database restore only when a full data rollback is explicitly approved.
6. Migration 004 is intentionally irreversible at the data level. A pre-migration backup may contain the removed PII and must remain access-controlled under the Contacts retention policy; do not restore it merely to recover legacy merge rollback.

Future Contacts schema changes must be owned here and registered through the UOK migration gate instead of expanding the shared initial baseline.
