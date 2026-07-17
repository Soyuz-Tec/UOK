# Compliance Document Type Migrations

**Status:** Active module-owned migrations.

**Current candidate:** `UOK-3.1.0-alpha.3`

`001_compliance_core.sql` creates the tenant-scoped
`compliance_document_types` registry and append-only
`compliance_document_type_name_history`. It enforces organization-scoped code
uniqueness, the three-state lifecycle, positive optimistic versions,
owner-local history linkage, universal organization/user references, and
organization-first indexes.

Apply it additively after a PostgreSQL backup and verify both tables,
constraints, foreign keys, and indexes before candidate promotion.
