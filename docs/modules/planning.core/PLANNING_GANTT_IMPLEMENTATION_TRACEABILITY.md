# Planning Gantt Implementation Traceability

**Status:** Active Gate A evidence map.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Owning decision:** `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`

## Purpose

This artifact distinguishes implemented source from verified behavior and gives
reviewers one place to find the acceptance test and evidence for every Gate A
requirement.

## Evidence states

| State | Required evidence |
|---|---|
| `planned` | Owner and acceptance condition recorded |
| `source_present` | Reviewable source exists |
| `unit_tested` | Focused deterministic test passes |
| `integration_tested` | API/database/module interaction passes |
| `runtime_proven` | Candidate runtime/UI proof is saved |
| `production_ready` | Security, performance, recovery, observability, and release gates pass in a production-like profile |

## Gate A traceability

| ID | Requirement | Initial evidence | Required proof before closure | Status |
|---|---|---|---|---|
| PLA-A-001 | Canonical CPM values | Logic-driven, calendar-aware CPM returns ES, EF, LS, LF, total/free float, target variance, and critical flags independent of stored dates and UI order | Independent chain, parallel, merge, lag/lead, calendar, target-date, and cycle fixtures | `runtime_proven` |
| PLA-A-002 | Independent hard-constraint validation | Separate validator recomputes CPM coverage, durations, dependencies, calendars, constraints, manual dates, float, project finish, and target variance and runs on accepted writes/read models | Add resource-capacity result validation and injected resource violation proof | `unit_tested` |
| PLA-A-003 | Stable Planning idempotency | UOK command gateway supports replay | Every REST write requires a client key; module-command missing-key, replay, changed-payload conflict, and lost-response retry tests pass | `integration_tested` |
| PLA-A-004 | Optimistic concurrency | Project revision/task version migration, strong actor-visible ETag, project lock, 428/412 recovery contract, and typed client recovery exist | PostgreSQL two-client race, candidate runtime, and accessible reload/reapply proof | `runtime_proven` |
| PLA-A-005 | Atomic batch mutation | Ordered task updates use one project lock, command/idempotency record, final scheduler/validator pass, revision, ETag, and correlated event; bulk UI and multi-task update history use the endpoint | Expand the operation-kind registry beyond `update_task` while retaining all-or-nothing semantics | `runtime_proven` |
| PLA-A-006 | Complete immutable baseline | Canonical v2 snapshot includes the complete current schedule graph/context, creator/source revision/correlation metadata, SHA-256 verification, append-only guards, comparison reads, and explicit legacy partial limitations | PostgreSQL migration apply/readback and candidate runtime checksum proof | `runtime_proven` |
| PLA-A-007 | Server capability enforcement | Server maps every command to `read`, `edit`, `baseline.create`, `level`, `link`, `gate.approve`, or `admin`; schedule/API return actor authority; UI fails closed and local review mode can only reduce it | Candidate runtime role matrix and direct-denial proof | `runtime_proven` |
| PLA-A-008 | Database invariant enforcement | Additive migration enforces dates, duration, progress, sort order, task/dependency types, scheduling mode, lag, allocation, unique project calendars/assignments, and supporting indexes | PostgreSQL 18 apply/readback and direct invalid-row probes | `runtime_proven` |
| PLA-A-009 | Structured Planning errors | Planning validation, permission, idempotency, precondition, and atomic-batch failures return stable code, field, object ids, repair, revision, and correlation id through REST and generic command paths; persisted failure logs store the same envelope | Candidate runtime proof for validation, denial, and missing-precondition envelopes | `runtime_proven` |
| PLA-A-010 | Typed Planning client | Explicit request/result/error contracts cover projects, tasks, dependencies, calendars, baselines, resources, assignments, batches, revisions, capabilities, history, and workspace actions | Candidate UI proof for the accessible repair/audit alert | `runtime_proven` |
| PLA-A-011 | End-to-end audit correlation | Every successful Planning response, module event, and schedule event carries the exact command-log ID, including derived task changes and batches | Candidate PostgreSQL join/readback across command, response, and both event streams | `runtime_proven` |
| PLA-A-012 | Accessible non-drag alternatives | Keyboard and inspector paths exist | Move, resize, progress, dependency, and create flows proven without dragging | `integration_tested` |

## Current slice evidence

- Draft review and exact current-head checks: [PR #20](https://github.com/Soyuz-Tec/UOK/pull/20)
- Backend REST integration proof: `modules/planning.core/tests/test_planning_rest_idempotency.py`
- Runtime/generated OpenAPI parity proof: `modules/planning.core/tests/test_planning_idempotency_contract.py`
- Generic command replay/conflict integration and synthetic insert-race recovery regression: `modules/planning.core/tests/test_planning_command_idempotency.py`
- Shared command-conflict regression: `modules/contacts.core/tests/test_contacts_command_safety.py`
- Frontend key propagation and lost-response retry proof: `web/src/features/planning/planningApi.test.ts`
- Backend revision, task-version, strict ETag, stale-write, replay-order, and route-coverage proof: `modules/planning.core/tests/test_planning_optimistic_concurrency.py`
- Additive module migration: `modules/planning.core/migrations/002_planning_optimistic_concurrency.sql`
- Live PostgreSQL two-client row-lock verifier: `modules/planning.core/tests/runtime/verify_planning_postgres_concurrency.py`
- Typed frontend stale-write recovery and fail-closed multi-write proof: `web/src/features/planning/planningApi.test.ts` and `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`
- Candidate PostgreSQL proof: two simultaneous writes returned exactly one `200` and one `412`; repeated concurrent reads never observed a mixed revision/schedule snapshot.
- Candidate/UI gates: `scripts/verify_uok_candidate.ps1` and `web/e2e/uok-proof.spec.ts` pass with atomic bulk controls enabled only through the batch endpoint.
- Canonical CPM and hand-worked oracle cases: `modules/planning.core/tests/test_canonical_cpm.py`
- Independent result validation with injected dependency, calendar, constraint, and manual-date faults: `modules/planning.core/tests/test_cpm_validation.py`
- API target-variance and UI-row-order independence proof: `modules/planning.core/tests/test_planning_cpm_contract.py`
- Persistent candidate negative-float/independent-validation proof: `modules/planning.core/tests/runtime/verify_planning_cpm.py`
- Atomic 100-operation success/replay, injected rollback, one-revision/task-version, structured-error, and correlation proof: `modules/planning.core/tests/test_planning_atomic_batch.py`
- Typed bulk and bounded multi-task history client proof: `web/src/features/planning/planningApi.test.ts`, `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`, and `web/src/features/planning/planningHistoryExecution.test.ts`
- Complete v2 baseline capture, checksum, compare, legacy, immutability, and tamper proof: `modules/planning.core/tests/test_planning_complete_baselines.py`
- Additive v2 baseline metadata/append-only migration: `modules/planning.core/migrations/003_planning_complete_baselines.sql`
- Typed baseline detail/compare reads and legacy UI warning proof: `web/src/features/planning/planningApi.test.ts` and `web/e2e/uok-proof.spec.ts`
- Candidate PostgreSQL proof: 12 existing snapshots classified as v1 `partial`; v2 columns/checks/index/trigger read back; trigger rejected mutation; v2 snapshot checksum/detail/correlation passed the live candidate verifier.
- Server capability mapping and adversarial direct-call denials: `modules/planning.core/tests/test_planning_capabilities.py`
- Typed fail-closed capability client and review-only UI proof: `web/src/features/planning/usePlanningCapabilities.test.tsx` and `web/e2e/uok-proof.spec.ts`
- Candidate runtime proof: operations receives edit/baseline/level/admin, viewer receives read-only, viewer direct project creation remains denied, and module verification passes after rebuild.
- Database constraint/duplicate rejection and additive migration proof: `modules/planning.core/tests/test_planning_database_invariants.py` and `modules/planning.core/migrations/004_planning_database_invariants.sql`
- End-to-end command/response/module-event/schedule-event correlation proof: `modules/planning.core/tests/test_planning_audit_correlation.py`
- Structured validation/permission/precondition error and persisted command-log parity proof: `modules/planning.core/tests/test_planning_structured_errors.py`
- Structured idempotency conflict proof: `modules/planning.core/tests/test_planning_command_idempotency.py` and `modules/planning.core/tests/test_planning_rest_idempotency.py`
- Typed request propagation, typed domain/precondition mapping, repair-status propagation, and accessible alert proof: `web/src/features/planning/planningApi.test.ts`, `web/src/features/planning/usePlanningWorkspaceMutations.test.tsx`, and `web/src/features/planning/PlanningErrorNotice.test.tsx`
- Candidate runtime proof: the module verifier inspected structured `403`, `400`, and `428` bodies and correlations; Chromium focused and announced the repair/field/revision/audit alert after a rejected mutation.
- Candidate PostgreSQL proof: all 13 invariant constraints and four indexes read back; direct invalid date/progress/scheduling-mode and duplicate calendar/assignment rows were rejected; seven candidate schedule events and seven module events all linked to succeeded commands, with all seven stored responses carrying the same correlation.
- Generated REST contract: `web/src/generated/openapi.json` and `web/src/generated/openapi.d.ts`

Exact commit SHAs and workflow-run identifiers belong in the mutable PR body and
GitHub check rollup so this durable map does not become stale when an evidence
commit changes the branch head.

## Current idempotency boundary

The current UOK command log scopes keys by organization and rechecks the
replaying actor's permission and module state. Persisted actor/application
scoping and original-actor audit attribution are not yet present in the command
log schema. They remain required before `production_ready` and are tracked with
the Gate A audit-correlation work rather than inferred from PLA-A-003's current
integration evidence.

## Current optimistic concurrency boundary

The project schedule is the aggregate revision root. Existing-project Planning
commands lock that project row, validate exactly one quoted strong `If-Match`
tag, execute the Python-authoritative mutation, increment the project revision
once, and increment every changed existing task version once in the same
transaction. Project creation starts at revision `1`; new tasks start at version
`1`.

The validator format is `"planning-r<revision>-sha256-<canonical digest>"`. The
digest covers the canonical actor-visible schedule, including calendar
availability context, rather than treating the revision number alone as a
strong validator. Missing tags return `428`; valid stale tags return `412` with
the current revision, tag, reload URL, and explicit repair guidance. Weak tags,
wildcards, lists, and malformed tags return `400`. Idempotent replay is checked
before first-execution precondition validation so a lost successful response can
still replay with its original tag.

Bulk task edits and multi-task update history now use one project-scoped atomic
batch. The first batch registry intentionally supports `update_task` only;
unsupported destructive, dependency, calendar, assignment, link, and gate
history kinds still fail closed rather than falling back to independent writes.
The project lock serializes Planning mutations, but `calendar.core`
availability remains read-only advisory context and is not locked by a Planning
transaction.

## Current atomic batch boundary

`POST /api/planning/projects/{project_id}/mutations:batch` accepts 1 to 500
ordered operations, one stable idempotency key, and the current strong ETag.
The command applies every task update in one transaction, runs schedule
propagation and independent validation once over the final proposed state,
increments the project revision once, increments each materially changed task
version once, and emits one `PlanningBatchApplied` event plus one module-owned
schedule event carrying the command correlation id. Any operation or final
schedule failure rolls the transaction back and returns a structured error.

## Required reference schedule cases

| Case | Expected evidence |
|---|---|
| Single chain | Correct early/late dates, zero-float critical path |
| Parallel paths | Shorter path receives correct float |
| Merge point | Longest predecessor controls merge date |
| FS, SS, FF, SF | Type-specific precedence holds |
| Positive lag / negative lead | Calendar-aware relation arithmetic is correct |
| Weekend and holiday | Non-working dates are excluded consistently |
| Milestone | Zero duration and equal start/finish |
| Summary | Excluded from CPM graph; dates/progress roll up from descendants |
| Manual task conflict | Dates stay fixed and a violation is returned |
| Target date | Negative float is reported rather than clamped away |
| Dependency cycle | Mutation is rejected and no partial write remains |

## Current server capability boundary

`planning.manage` is replaced by explicit `planning.edit`,
`planning.baseline.create`, `planning.level`, `planning.link`,
`planning.gate.approve`, and `planning.admin` permissions alongside
`planning.read`. Every existing command maps to exactly one declared permission;
dependency editing remains schedule edit authority, while `planning.link` is
reserved for Gate B cross-module links.

The actor-specific capability matrix is returned by
`GET /api/planning/capabilities` and embedded in each schedule read model. The
operations role receives all current capabilities, the trader role receives
read/edit, and finance/viewer roles remain review-only. The frontend defaults to
review-only until the server matrix loads, disables specialized baseline and
leveling actions independently, and cannot use its local review toggle to grant
server authority. Direct REST and generic-command probes remain denied even
when callers supply valid IDs, ETags, and idempotency keys.

## Current database and audit boundary

Migration `004_planning_database_invariants.sql` is additive and leaves prior
numbered migrations unchanged. It enforces project/task date order, nonnegative
duration and sort order, 0-100 progress, accepted task/dependency types,
non-self dependencies, -30 to +30 day lag/lead, 1-300 allocation, auto/manual
scheduling mode, one project calendar, and one assignment per
organization/task/resource. It also adds organization-first hierarchy,
predecessor, successor, and resource-assignment indexes. Existing foreign-key
`NO ACTION` behavior and the manifest retention policy continue to prevent
implicit destructive cascades.

Every Planning handler now uses one module-local audit adapter. The adapter
overwrites any caller-provided correlation field with the authoritative command
log ID and writes it to both event streams. The concurrency wrapper adds the
same ID to every successful REST/generic result after the final revision and
ETag are calculated, so response metadata cannot change schedule truth. Failed
commands use the same command-log ID as their returned error correlation, and
the persisted response body is the exact returned structured envelope.

## Current structured error and typed client boundary

Planning command validation, capability denial, idempotency conflict, optimistic
precondition, and atomic-batch failure responses use transport-neutral error
objects. Each object identifies a stable code, human message, relevant field and
object IDs, a repair action, the current revision when available, and an audit
correlation ID. Validation and precondition failures persist the same envelope
against the attempted command; permission denials persist a denied command; an
idempotency conflict references the original successful command.

The browser client validates those envelopes at the HTTP boundary and exposes
typed domain and precondition errors. Mutation intents, history, Gantt inline
edits, inspector forms, dependencies, calendars, baselines, resources,
assignments, and batch updates now use explicit Planning request types. Domain
failures render a focused `role=alert` containing the server message, repair,
field, current revision, and audit reference. Unknown or legacy failure bodies
remain a generic API error and cannot enter stale-write recovery.

## Current complete baseline boundary

New baselines are schema version `2`, immutable, and append-only. Their
canonical JSON captures project identity/revision/target/timezone, all tasks and
hierarchy, scheduling modes and constraints, dependencies, the Planning
calendar and exceptions, resources, assignments, the current empty typed-link
set, calculated metrics/engine version, creator, timestamp, and command
correlation. The stored SHA-256 checksum is recomputed for schedule reads,
detail reads, and comparisons.

Existing rows are additively backfilled as schema version `1` with
`completeness=partial`; their missing facts are returned explicitly and compare
fails closed. PostgreSQL rejects baseline updates and deletes with a migration
trigger, while SQLAlchemy rejects ORM mutations in every profile. The comparison
read reports exact added, removed, and changed object IDs only when both inputs
are complete and hash verified.

## Current CPM boundary

The `uok-cpm-1` engine calculates a logic-driven earliest schedule from the
project start, task durations, hard date constraints, manual dates, working
calendar, and the dependency graph. Persisted planned dates remain the approved
schedule displayed by the Gantt; they are not relabeled as CPM early dates.
Summary tasks are excluded from the graph and dependency links to summaries are
rejected.

The project compatibility `end` value is currently the explicit target finish.
When the target is later than the calculated finish, late dates anchor to the
calculated finish so the longest path remains zero-float and visible. When the
target is earlier, late dates anchor to the target and negative float is
reported without moving the commitment or clamping the value. A future
planned/forecast/target date migration will replace this compatibility mapping.

The independent validator deliberately lives outside the CPM implementation and
recomputes hard invariants from the published result. Resource-capacity
validation remains open because current over-allocation is an explicit warning,
not a hard scheduling constraint; PLA-A-002 therefore remains `unit_tested`
rather than being promoted to integration closure.

## Closure rule

A row may advance only when the evidence is present on the current branch and
the narrow relevant check passes. `production_ready` requires the production
hardening profile and cannot be inferred from local alpha tests.

Before Gate A closes, link this artifact from:

- `docs/DOCUMENTATION_INDEX.md`;
- `docs/ARCHITECTURE.md`;
- `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`;
- `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md`.
