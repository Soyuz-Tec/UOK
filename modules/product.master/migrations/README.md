# Product Master Migrations

**Status:** Active module-owned migrations.

**Current candidate:** `UOK-3.1.0-alpha.3`

`001_product_master.sql` creates the tenant-scoped `product_definitions` registry and append-only `product_name_history`. It enforces organization-scoped code uniqueness, controlled lifecycle status, positive optimistic versions, owner-local history linkage, universal organization/user references, and organization-first indexes.

Apply it additively after a PostgreSQL backup and verify both tables, constraints, foreign keys, and indexes before candidate promotion.
