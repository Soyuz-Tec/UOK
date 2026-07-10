# UOK Planning Scale Budgets

**Status:** Active Gate E runtime evidence

**Current candidate:** `UOK-3.1.0-alpha.3`

## Approved budgets

| Scenario | Budget |
|---|---:|
| 500 tasks / 800 dependencies schedule read | p95 under 500 ms |
| 2,000 tasks / 3,000 dependencies deterministic validation | p95 under 2,000 ms |
| 100 task updates in one transaction | p95 under 2,000 ms |
| 500-row Gantt initial interaction | under 2,000 ms |
| Post-idle browser long task | under 200 ms |

## Repeatable commands

Run the backend benchmark inside the rebuilt PostgreSQL-backed candidate:

```powershell
podman exec uok-api-1 python /app/scripts/planning_scale_benchmark.py --samples 6
```

The script creates project/task/dependency fixtures inside one database
transaction and rolls the transaction back. Confirm no fixture persisted:

```powershell
podman exec uok-db-1 psql -U uok -d uok -Atc "SELECT count(*) FROM planning_projects WHERE name LIKE 'Scale benchmark %';"
```

Run the Chromium budget plus all UI regressions:

```powershell
Set-Location web
npx playwright test --project=chromium
```

## Recorded production-like profile

Recorded 2026-07-10 after rebuilding the local Podman candidate:

- PostgreSQL 18 candidate database;
- Python 3.14.6 on Linux/WSL2 x86-64;
- 16 logical CPUs;
- six measured samples after one warm-up schedule read;
- schedule read p95: 96.51 ms;
- deterministic validation p95: 16.52 ms;
- atomic batch p95: 190.75 ms;
- persisted benchmark projects after rollback: `0`.

The controlled single-worker eight-test Chromium verification run recorded 1,179.30 ms to usable interaction,
34 mounted grid rows, 34 mounted timeline tasks, and no post-idle long task
long task for the 500-row fixture. The pre-windowing baseline was 4,073.60 ms,
which justified the ADR-0016 virtualization decision.

The UI proof uses one browser worker so the performance assertion is not
contaminated by competing synthetic Chromium workloads on the same CPU. This
worker profile is part of the recorded evidence and must change only with a new
reviewed baseline.

## Interpretation and change control

These are local production-like Gate E results, not a production-readiness
claim. Record hardware/profile with every revised result. Change a budget only
through reviewed evidence and update ADR-0016, this runbook, Planning
traceability, and the browser/backend executable checks together.

Virtualization activates only above 200 visible rows. It uses the authoritative
full schedule already returned by the API, a shared variable-height layout,
480-pixel overscan, synchronized grid/timeline scrolling, and accessibility row
metadata. Revert the renderer slice to roll back; there is no schema or retained
benchmark data to undo.
