# Communications Core Migrations

**Status:** Active module-owned migrations

**Current candidate:** `UOK-3.1.0-alpha.3`

`001_communications_core.sql` adds the organization-scoped thread provider used
by K Connect and Planning typed links. Apply it additively after a PostgreSQL
backup and verify columns, lifecycle constraint, foreign keys, and
organization-first indexes before rebuilding the candidate runtime.
