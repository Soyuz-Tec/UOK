# Contacts Core Migrations

Contacts table ownership is declared in `modules/contacts.core/manifest.yaml` and validated through the migration discipline gate.

`001_contacts_core_operational_indexes.sql` is the first module-owned migration. It keeps Contacts list, search, review queue, ownership, relationship, note, and import-batch workflows indexed without adding product, cargo, or CRM-specific tables to the UOK baseline.

`002_contacts_core_groups.sql` adds module-owned persistent contact groups and group memberships. It keeps user-managed grouping inside `contacts.core` so the UOK baseline remains module-neutral.

The Contacts search index is PostgreSQL-oriented and supports the runtime full-text search path. The application keeps a Python search fallback for non-Postgres local test workflows.

Future Contacts schema changes must be owned here and registered through the UOK migration gate instead of expanding the shared initial baseline.
