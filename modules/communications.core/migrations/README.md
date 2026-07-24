# Communications Core Migrations

**Status:** Active module-owned migrations

**Current candidate:** `UOK-3.1.0-alpha.3`

`001_communications_core.sql` adds the organization-scoped thread provider used
by K Connect and Planning typed links. Apply it additively after a PostgreSQL
backup and verify columns, lifecycle constraint, foreign keys, and
organization-first indexes before rebuilding the candidate runtime.

`002_communications_thread_recoverable_delete.sql` persists the exact open or
closed state displaced by a recoverable thread Delete and constrains archived
rows so Restore cannot guess their prior lifecycle state. It also adds the
positive per-thread revision used by the strong ETag/`If-Match` concurrency
contract accepted in ADR-0029. Legacy archived rows have no prior-state fact and
are explicitly normalized to the compatibility state `open` during migration.
