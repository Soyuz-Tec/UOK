# planning.core migrations

Module-owned SQL migrations for Planning tables and indexes.

Apply files in numeric order. `002_planning_optimistic_concurrency.sql` is an
additive PostgreSQL migration that backfills project revisions and task versions
to `1`; it does not rewrite or remove existing Planning data.
`003_planning_complete_baselines.sql` adds v2 baseline integrity metadata,
labels existing rows as legacy `partial` snapshots, and installs an append-only
PostgreSQL trigger that rejects baseline updates and deletes.
`004_planning_database_invariants.sql` adds validated date, task, dependency,
allocation, scheduling-mode, and uniqueness constraints plus hierarchy,
dependency-direction, and resource-assignment indexes. Run the documented
duplicate/invalid-row preflight before applying it to an existing database.
`005_planning_operation_links.sql` adds Planning-owned typed references to
optional cross-module targets. It stores stable target identity and sanitized
resolver provenance without foreign keys into optional module tables; target
modules retain authorization, lifecycle, privacy, and retention ownership.

For the persistent local PostgreSQL profile, back up first, apply the migration
before rebuilding an image that selects the new columns, and read the columns
and constraints back from PostgreSQL:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action BackupDb
Get-Content -Raw .\modules\planning.core\migrations\002_planning_optimistic_concurrency.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
Get-Content -Raw .\modules\planning.core\migrations\003_planning_complete_baselines.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
Get-Content -Raw .\modules\planning.core\migrations\004_planning_database_invariants.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
Get-Content -Raw .\modules\planning.core\migrations\005_planning_operation_links.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
```

The repository currently inventories module migrations but does not apply them
automatically. Production-like deployment automation must add an ordered
migration runner before this slice can be classified `production_ready`.
