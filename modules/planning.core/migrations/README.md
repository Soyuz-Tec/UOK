# planning.core migrations

Module-owned SQL migrations for Planning tables and indexes.

Apply files in numeric order. `002_planning_optimistic_concurrency.sql` is an
additive PostgreSQL migration that backfills project revisions and task versions
to `1`; it does not rewrite or remove existing Planning data.

For the persistent local PostgreSQL profile, back up first, apply the migration
before rebuilding an image that selects the new columns, and read the columns
and constraints back from PostgreSQL:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action BackupDb
Get-Content -Raw .\modules\planning.core\migrations\002_planning_optimistic_concurrency.sql |
  podman compose -p uok -f .\deploy\compose-local-18088.yaml exec -T db psql -v ON_ERROR_STOP=1 -U uok -d uok
```

The repository currently inventories module migrations but does not apply them
automatically. Production-like deployment automation must add an ordered
migration runner before this slice can be classified `production_ready`.
