# ADR-0003: Planning Gate A Stabilization

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-09

## Context

`planning.core` already provides a first-party Gantt renderer, Python scheduling,
dependencies, calendars, baselines, resources, audit events, and UI proof. The
existing alpha proves useful breadth, but source presence is not the same as
production evidence. The next slice must stabilize schedule correctness and
write safety before operation-control or advanced-analysis expansion.

The reviewed gaps are:

- CPM metrics need independent reference cases and hard-constraint validation;
- Planning REST writes do not yet carry a stable client idempotency key;
- projects and tasks have no optimistic concurrency revision contract;
- bulk edits use independent requests and can partially commit;
- baseline snapshots contain only task identity and planned dates;
- review mode is a client interaction state rather than server authorization;
- database constraints do not fully enforce Planning invariants;
- the feature catalog uses `Implemented` for evidence of different maturity.

## Decision

Implement Gate A as a sequence of small, independently reviewable changes.

### Evidence maturity

Planning feature status uses these states:

1. `planned`
2. `source_present`
3. `unit_tested`
4. `integration_tested`
5. `runtime_proven`
6. `production_ready`

No feature is promoted beyond the evidence linked from its traceability row.

### Scheduling correctness

- Python remains authoritative for dependency propagation, calendars,
  constraints, CPM, and resource analysis.
- UI row order is never scheduling logic.
- CPM must pass hand-worked chain, parallel-path, merge, lag/lead, calendar,
  milestone, manual-task, target-date, and cycle cases.
- A separate validator checks every accepted result against hard constraints.

### Idempotency

- Every Planning write accepts a stable client-supplied idempotency key.
- Replaying the same key and payload returns the original result.
- Reusing a key for a different command or payload returns a conflict.
- The same key is reused by any retry of one user intent.

### Concurrency

- The project schedule is the aggregate revision root.
- Every accepted schedule mutation increments the project revision once.
- Direct task changes also increment the task version.
- Schedule reads return a revision validator; writes reject a stale expected
  revision with a structured conflict response.

### Atomic batch mutations

- Bulk edits use one project-scoped endpoint and one database transaction.
- Operations are ordered, authorized, and validated as one final proposed
  schedule.
- A hard failure rolls back every operation.
- One successful batch creates one project revision and one audit correlation.

### Baselines

- New baselines are immutable, schema-versioned canonical snapshots.
- They include project, tasks, hierarchy, dependencies, constraints, calendar,
  resources, assignments, calculation metadata, creator, source revision, and
  SHA-256 checksum.
- Existing baselines are labeled `partial`; they are never presented as
  equivalent to complete baselines.

### Authorization

Replace coarse Planning write behavior with server-enforced capabilities for:

- edit;
- baseline creation;
- resource leveling;
- cross-module links;
- gate approval;
- administration.

The UI derives available actions from server capabilities. A local review toggle
may reduce actions but cannot grant or revoke authority.

### Database integrity

Add module-owned migrations for revisions, baseline metadata, unique project
calendars and assignments, and checks covering dates, task/dependency types,
progress, allocation, scheduling mode, and accepted lag policy.

Existing numbered migrations remain immutable.

## Boundaries

- No new Gantt renderer dependency.
- No Next.js, Node scheduling service, or alternate backend.
- No solver, Monte Carlo, virtualization, or operation-link schema in Gate A.
- `calendar.core` remains the shared availability owner; Planning calendars
  remain the schedule authority.
- Export generation remains in the global artifact/report capability.

## Implementation order

1. Add this ADR and the Planning traceability artifact.
2. Add stable REST idempotency-key propagation and replay tests.
3. Add deterministic CPM fixtures and independent validation.
4. Add additive revision and baseline metadata migration.
5. Add optimistic concurrency and structured conflicts.
6. Add atomic batch mutation and replace client parallel bulk edits.
7. Add complete baseline serialization and verification.
8. Add server capability split and adversarial tests.
9. Reclassify feature evidence and run the full candidate gate.

## Required verification

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest modules/planning.core/tests -q
python -m pytest -q
npm --prefix web test
npm --prefix web run test:ui-proof
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
```

## Consequences

- Gate A may temporarily slow feature expansion, but it creates a reliable
  schedule foundation and a defensible evidence trail.
- API clients must retain idempotency and revision metadata.
- Old baselines remain readable with an explicit partial-completeness warning.
- Operation Control Workspace work starts only after Gate A exits successfully.

