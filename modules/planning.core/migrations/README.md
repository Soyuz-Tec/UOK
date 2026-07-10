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
`006_planning_date_semantics.sql` adds a defaulted project IANA timezone plus
nullable forecast, actual, and deadline task columns. It enforces forecast and
actual ordering, requires an actual start before actual finish, and adds the
deadline access index. Application validation recognizes IANA names and
requires a reason for actual-date changes.
`007_planning_task_participants.sql` adds Planning-owned task/Party role
memberships with controlled role and source checks, same-module project/task
foreign keys, unique Party/role membership, and organization-first Party and
task-role indexes. `party_id` intentionally has no foreign key because
`contacts.core` retains optional-module lifecycle, authorization, and privacy.
`008_planning_task_requirements.sql` adds Planning-owned task requirements with
controlled type/state and decision-metadata checks, optional same-module typed
link references, and organization/project/task state and due-date indexes.

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
Get-Content -Raw .\modules\planning.core\migrations\006_planning_date_semantics.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
Get-Content -Raw .\modules\planning.core\migrations\007_planning_task_participants.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
Get-Content -Raw .\modules\planning.core\migrations\008_planning_task_requirements.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
```

The repository currently inventories module migrations but does not apply them
automatically. Production-like deployment automation must add an ordered
migration runner before this slice can be classified `production_ready`.
