# ADR-0003: Planning Gate A Stabilization

**Status:** Accepted

**Implementation:** Implemented. Current evidence is maintained in the Planning
traceability artifact and repository verification gates; historical branch and
test-count snapshots are not lifecycle authority.

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
- Client keys contain 16 to 128 characters from ASCII letters, digits, `.`,
  `_`, `:`, and `-`, beginning with a letter or digit.
- The generic command endpoint requires a client key for every command; the
  server does not synthesize one for that path.
- Replaying the same key and payload returns the original result.
- Reusing a key for a different command or payload returns HTTP `409`.
- The same key is reused by any network retry of one user intent.

### Concurrency

- The project schedule is the aggregate revision root.
- Every accepted schedule mutation increments the project revision once.
- Direct task changes also increment the task version.
- Schedule reads return one quoted strong ETag, never a weak `W/` validator.
  The tag is a SHA-256 validator over the canonical actor-visible schedule
  representation, including the project revision and deterministic
  versions/hashes for contextual contributions such as capabilities and
  `calendar.core` availability. A revision number alone is not a strong
  validator while those values share the representation.
- Meaningful mutations require `If-Match`; a missing precondition returns HTTP
  `428` and a stale precondition returns HTTP `412` with a structured recovery
  response.
- The mutation contract accepts exactly one quoted strong tag. Weak tags,
  wildcard `*`, and validator lists are invalid because they could bypass the
  concurrency guarantee.
- `If-Match` is authoritative. `expected_revision` is optional compatibility
  metadata; when present it must agree with the revision represented by
  `If-Match`, or the request fails as an internally inconsistent precondition.
- HTTP `409` remains reserved for idempotency and domain-state conflicts, not
  missing or stale revision preconditions.
- Review-only contracts that allow weak ETags or map a missing/stale revision
  precondition to HTTP `409` are superseded by this decision.

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
2. Add stable REST and module-command idempotency-key propagation, lost-response
   retry, replay, and changed-payload conflict tests.
3. Add the project revision/task version migration, strong schedule ETags,
   optimistic concurrency, and explicit stale-write recovery.
4. Add deterministic CPM fixtures and independent validation.
5. Add structured Planning errors and atomic batch mutation; replace client
   multi-write bulk/history flows.
6. Add complete baseline metadata, serialization, and verification.
7. Add server capability split and adversarial tests.
8. Add remaining database invariants and audit correlation.
9. Reclassify feature evidence and run the full candidate gate.

## Required verification

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest modules/planning.core/tests -q
python scripts/run_python_tests.py
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

## Verification outcome

Gate A exited its local/runtime implementation gate on 2026-07-10. The Planning
traceability artifact and current repository gates record the exact
requirement-level proof without relying on a stale fixed test count.

This outcome authorized Gate B implementation. It does not mark the alpha as
`production_ready`; security, performance, recovery, observability, deployment,
and release qualification remain separate gates.
