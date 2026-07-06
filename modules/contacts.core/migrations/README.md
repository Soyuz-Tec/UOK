# Contacts Core Migrations

Contacts table ownership is declared in `modules/contacts.core/manifest.yaml` and validated through the migration discipline gate.

`001_contacts_core_operational_indexes.sql` is the first module-owned migration. It keeps Contacts list, review queue, ownership, relationship, note, and import-batch workflows indexed without adding product, cargo, or CRM-specific tables to the UOK baseline.

Future Contacts schema changes must be owned here and registered through the UOK migration gate instead of expanding the shared initial baseline.
