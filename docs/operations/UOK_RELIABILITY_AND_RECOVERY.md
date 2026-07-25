# UOK Reliability and Recovery

**Status:** Implemented engineering baseline; production targets and accounts
remain owner decisions.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Define executable health, SLI, backup, restore, and restart
controls without treating local evidence as production reliability.

**Applies to:** the local `127.0.0.1:18088` candidate, governed Windows
recovery, disposable restore drills, and future production qualification.

## Health contract

UOK exposes three unauthenticated, intentionally bounded probes:

- `GET /health/live` proves that the API process can serve requests. It does not
  touch PostgreSQL.
- `GET /health/ready` proves that PostgreSQL responds and that the target schema
  version is applied. It returns HTTP 503 when either check fails.
- `GET /health` preserves candidate-verifier compatibility, uses the readiness
  result, and adds only the non-secret candidate-state label.

Event and failed-command counts are not public health data. An authenticated
actor with `architecture.read` can inspect tenant-scoped counts, migration
discipline, module contracts, and pool telemetry at
`GET /api/operations/diagnostics`.

## Bounded SLI evidence

Collect point-in-time liveness and readiness evidence without credentials:

```powershell
python .\scripts\collect_sli_evidence.py `
  --base-url http://127.0.0.1:18088 `
  --samples 30 `
  --require-targets
```

The default engineering baseline is 99.5% successful samples and a 500 ms p95
for both endpoints. These are development gates, not a business-approved
production SLO. Evidence is written under ignored `var/evidence/operations/`.
A production SLO requires an approved service window, error-budget policy,
measurement window, and alert owner.

## Recovery targets and evidence

The existing PostgreSQL backup and restore operations remain the authoritative
local recovery mechanism. A production promotion requires:

1. owner-approved RPO, RTO, retention, encryption, and offsite destination;
2. scheduled backups with independently monitored completion and age;
3. two successful restore exercises using production-like volume and schema;
4. a recorded rollback decision and immutable image digest;
5. a sustained staging window with SLI and incident evidence.

Never perform an automated destructive restore against shared data. Use a
disposable database for drills and keep generated dumps and reports under
`var/`.

Run a disposable restore drill only with an immutable PostgreSQL image ID or
digest:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\verify_postgres_backup_restore.ps1 `
  -BackupPath .\var\backups\postgres\<dump-file>.dump `
  -DatabaseImage <64-character-image-id>
```

The drill validates the custom dump, creates GUID-named and labeled container
and volume resources, publishes no ports, uses `--network none`, restores in
one transaction, reads the public schema and version registry, writes local
evidence, and proves both disposable resources were removed. It never stops,
recreates, connects to, or mutates the shared UOK runtime.
