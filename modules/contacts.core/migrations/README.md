# Contacts Core Migrations

Contacts currently uses the shared alpha baseline migration. Its table ownership is declared in `modules/contacts.core/manifest.yaml` and validated through the migration discipline gate.

Future Contacts schema changes must be owned here and registered through the UOK migration gate instead of expanding the initial shared baseline.
