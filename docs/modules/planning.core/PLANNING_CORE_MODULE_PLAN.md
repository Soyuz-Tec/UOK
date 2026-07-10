# Planning Core Module Plan

**Status:** Active module plan; Gate A, all five Gate B slices, and all four Gate C resource-intelligence slices runtime-proven.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`planning.core` provides project planning, task scheduling, dependencies, audit events, and a Gantt workspace as an optional UOK capability module. It must stay integrated with the existing UOK stack and must not become a separate project-management application.

Planning Gate A is governed by `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`. Requirement maturity, verification evidence, and closure status are tracked in `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md`.

## Stack Contract

- Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL.
- Frontend: React, TypeScript, Vite, CSS design tokens.
- Gantt UI: first-party React, TypeScript, SVG, HTML, and CSS renderer behind a UOK adapter; external Gantt tools may inform feature vocabulary but must not be copied or added as renderer dependencies for this candidate.
- Scheduling logic: Python module service first, with React receiving validated schedule read models.
- Shared availability: `planning.core` depends on `calendar.core` for organization calendar events and free-busy context in Planning read models. Planning still owns Gantt working days, holidays, ignored periods, dependencies, resource leveling, task normalization, and schedule validation.

## Current MVP Scope

Detailed feature inventory and implementation status are tracked in `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md`.

- project list
- project schedule read model
- editable task grid and inspector path for create, update, delete, hierarchy, status, progress, and task type
- traditional Gantt workspace with compact project command bar, Gantt view tab rail, project metadata chips, selection control, grid/timeline, keyboard row navigation, task command toolbar, task row context menu, expand/collapse, cascade sorting, field presets, filters, undo/redo, global export/import boundary use, hour/day/week/month/quarter/year scale controls, today/fit/focus controls, critical and baseline toggles, read-model Board/List/Calendar/Workload/People/Dashboard views, and tabbed inspector panels
- Gantt bars
- milestone and summary task model
- dependency create, update, remove with finish-to-start, start-to-start, finish-to-finish, start-to-finish, lag, and lead
- Python scheduling propagation for dependency-driven successor movement
- working calendar storage with working-day and holiday-aware task normalization and propagation
- read-only `calendar.core` availability overlay correlated by actor-visible task participant and assigned-resource Party IDs, with exact task-specific busy warnings
- hierarchy validation, WBS read model, and summary rollups
- canonical logic-driven CPM read model fields for early/late dates, total/free float, target variance, and critical flags, with a separate hard-constraint validator
- immutable v2 baseline capture with complete canonical schedule snapshots, SHA-256 verification, source revision/creator/correlation metadata, explicit legacy partial warnings, comparison reads, baseline variance fields, per-row timeline lanes, and variance badges
- typed resource creation with controlled type/capacity/unit, optional actor-safe canonical references, effective dates, resource weekdays/holidays/capacity exceptions, assignment/allocation display, independently validated resource/day capacity points, over-allocation warnings, and resource-calendar-aware leveling for later auto-scheduled assigned tasks
- drag-to-reschedule path through server validation
- command-bus writes and idempotency
- project-root optimistic concurrency with additive revisions/task versions, canonical strong schedule ETags, exact `If-Match`, and explicit `428`/`412` recovery
- project-scoped atomic task-update batches with ordered operations, one final schedule validation, one revision/ETag, correlated events, and all-or-nothing rollback
- server-derived Planning capability matrix with separate edit, baseline, leveling, cross-module link, gate approval, and administration permissions; UI review mode may only reduce server authority
- database-enforced Planning date/type/progress/lag/allocation/scheduling-mode and uniqueness invariants with organization-first hierarchy/dependency/assignment indexes
- one command correlation ID across successful responses, derived schedule changes, module events, and Planning schedule events
- one structured error envelope across Planning validation, permission, idempotency, precondition, and batch failures, with the exact failed, denied, or original command-log correlation
- explicit TypeScript request, mutation-result, domain-error, and precondition contracts propagated through Gantt, inspector, history, resource, baseline, and batch actions
- accessible domain-failure alert with server repair guidance, field, current revision, and audit reference
- server-owned planned/in-progress/blocked/complete status vocabulary and transition policy with structured invalid-value/transition rejection
- revision-aware supported undo/redo operations that carry the source command through one atomic batch, reject stale inverses, preserve latest server state, and fail closed for unsupported/destructive history
- keyboard/form alternatives for task dates, progress, dependency, and creation mutations, with successful inline focus restoration and announced stale-state recovery
- Planning-owned typed project/task links with actor-specific `ready`, `unavailable`, `denied`, and `missing` resolver states; live Party, report-artifact/document/evidence, calendar-event, and K Connect thread providers; optional Operation Graph providers remain explicitly unavailable
- distinct scheduler-owned planned, planner-owned forecast/deadline, and reason-audited actual dates; project IANA timezone, UTC storage, DST-safe calendar-date conversion, variance fields, and visual-only subday scale disclosure
- first-class task participants with controlled responsibility roles, canonical actor-authorized Party resolution, project revision/task version/audit/baseline evidence, People inspector/view, and participant filtering
- first-class task requirements with controlled submission/review/decision states, separate gate approval authority, matching typed evidence links, fail-closed task/project readiness, baseline/audit evidence, Gates inspector, and blocker filtering
- planning audit events
- manifest-declared API router, command handlers, command permissions, role grants, dashboard provider, evidence provider, model exports, and candidate verifier
- Playwright UI proof for Gantt rendering, editor panels, keyboard focus, appearance, responsive layout, screenshot nonblank checks, and console cleanliness

## Module Ownership

Module files:

- `modules/planning.core/manifest.yaml`
- `modules/planning.core/backend/uok_planning_core`
- `modules/planning.core/migrations`
- `modules/planning.core/tests`
- `web/src/features/planning`

Shared shell and reusable controls remain under `web/src/shared` and `web/src/features/modules`.

## Scheduling Authority

All project, task, dependency, and reschedule changes must pass through Python validation before the UI accepts them. The React Gantt component may initiate drag-style changes, but it must call the planning API or command bus and reload the validated schedule read model after the server accepts the change.

## Operation Link Boundary

ADR-0004 governs Gate B cross-module links. Planning owns stable reference,
scope, relationship, blocking intent, revision, and audit evidence. Target
modules own source identity details, authorization, lifecycle, privacy, and
retention. A disabled or deleted provider target remains visible as an explicit
unavailable link; an unauthorized actor receives no target identity or label.
Operation, shipment, asset, location, and agreement providers are not present
in this candidate and must not be represented as resolved objects. ADR-0008
provides the real `communications.core` K Connect thread adapter; Planning still
owns only the typed link and actor-specific resolver state.

## Communication Thread Boundary

ADR-0008 governs the K Connect provider. `communications.core` owns thread
identity, title, context, authorization, lifecycle, audit, and retention.
Planning stores no provider foreign key or payload. A ready link opens the
exact authorized thread through the shared `view=communications&thread_id=...`
route; denied, missing, archived, and disabled-provider targets fail closed.

## Date Semantics Boundary

ADR-0005 governs execution dates. Existing task `start_at`/`end_at` remain the
planned schedule and compatible `start`/`end` API. Forecast, actual, and
deadline values are separate facts and are never changed by dependency
propagation, summary rollup, or leveling. Actual corrections require an audit
reason. Project-local ISO dates are converted through the immutable project
IANA timezone to UTC storage and back; hour and minute Gantt scales do not imply
time-of-day scheduling.

## Task Participant Boundary

ADR-0006 governs Planning participant records. Planning owns task scope and the
controlled owner/assignee/approver/consulted/informed/external-contact role;
`contacts.core` owns canonical Party identity, authorization, lifecycle,
privacy, and retention. New membership requires an active authorized Party.
Existing membership survives provider disablement as an explicit unavailable
state, while denied reads hide Party identity. Participant roles remain
separate from resource capacity and allocation.

## Typed Resource Boundary

ADR-0009 governs Gate C resource facts. Planning owns resource type, declared
capacity/unit, effective dates, assignment share, project revision, audit, and
baseline evidence. Optional canonical targets resolve through the existing
actor-specific provider boundary without a cross-module foreign key or copied
payload. Participants continue to represent responsibility; resources
represent constrained capacity. Existing rows and payloads remain compatible
as one human FTE. Effective dates are persisted in this slice; daily resource
calendar enforcement follows ADR-0010.

## Resource Capacity Calendar Boundary

ADR-0010 governs resource availability. Planning owns one capacity calendar per
resource, including weekdays, holidays, default percentage, and bounded
non-overlapping exceptions. Project working days remain schedule authority;
resource capacity is an additional hard availability input. Engine v2 and a
separate validator derive the same daily capacity, workload UI consumes those
validated points, and explicit leveling avoids zero-capacity dates. ADR-0012
governs the `simple_forward` strategy, bounded operator-configured horizon,
explicit outcomes, remaining overloads, stable reasons, audit evidence, and
independent post-level validation. This heuristic is not optimization.

## Explainable Leveling Boundary

`LevelPlanningResources` returns `leveled`, `partially_leveled`, or
`infeasible` with the exact changed tasks and remaining resource/date/task
overloads. Manual work is never moved. Horizon, project-finish,
allocation-capacity, and immovable-manual reasons remain explicit. A separate
validator recomputes schedule and capacity evidence and rolls back mismatched
reports. Approved baselines remain immutable.

## Calendar Correlation Boundary

ADR-0011 governs `calendar.core` context. Planning derives per-task canonical
Party sets only from actor-visible ready participants and assigned resources.
The Calendar provider filters occurrences by those Party IDs; Planning adds the
exact affected task IDs and warns only overlapping linked tasks. Unrelated
organization events and denied/private Party events remain absent. These events
are contextual warnings and never silently reschedule work.

## Task Requirement And Readiness Boundary

ADR-0007 governs Planning task requirements. Planning owns the requirement
workflow, required/optional intent, due date, decision authority and reason,
readiness rollup, revision/version, audit, and baseline evidence. Provider
modules retain evidence identity, authorization, lifecycle, privacy, and
retention behind typed Planning links. Required unsatisfied or waived gates
block readiness; a linked source that becomes unavailable re-blocks readiness
without rewriting the audited decision. Evidence, document, and shipment
requirements accept only matching link kinds and fail closed when the source is
not actor-visible and ready.

The current release validates:

- required dates
- end date on or after start date
- dependency references inside the project
- self-dependency rejection
- dependency type-specific date ordering
- dependency and hierarchy cycle detection
- parent references inside the project
- cross-project resource assignment rejection
- resource over-allocation warnings

## Acceptance Checks

Required checks before handoff:

```powershell
python -m pytest modules/planning.core/tests/test_planning_core.py -q
python -m pytest modules/planning.core/tests/test_planning_optimistic_concurrency.py -q
python -m pytest modules/planning.core/tests/test_canonical_cpm.py modules/planning.core/tests/test_cpm_validation.py modules/planning.core/tests/test_planning_cpm_contract.py -q
python -m pytest modules/planning.core/tests/test_planning_idempotency_contract.py -q
python -m pytest modules/planning.core/tests/test_planning_structured_errors.py -q
python -m pytest modules/planning.core/tests/test_planning_complete_baselines.py -q
python -m pytest modules/planning.core/tests/test_resource_capacity_validation.py modules/planning.core/tests/test_planning_status_policy.py -q
python -m pytest modules/planning.core/tests/test_planning_typed_resources.py -q
python -m pytest modules/planning.core/tests/test_planning_resource_calendars.py -q
python -m pytest modules/planning.core/tests/test_planning_links.py -q
python -m pytest modules/planning.core/tests/test_planning_date_semantics.py -q
python -m pytest modules/planning.core/tests/test_planning_participants.py -q
python -m pytest modules/planning.core/tests/test_planning_requirements.py -q
python -m pytest modules/communications.core/tests modules/planning.core/tests/test_planning_communication_links.py -q
npm --prefix web run build
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

## Deferred Work

- expand the atomic batch operation registry beyond task updates; unsupported destructive/dependency/calendar/assignment history kinds remain fail closed
- resource calendar time-of-day shifts and recurring exception patterns beyond calendar-date capacity
- deeper write integration that can publish selected Planning tasks or milestones to `calendar.core` events after user approval
- richer baseline history and comparison controls beyond the current immutable detail/compare API and legacy warning
- richer critical path dependency-chain explanation beyond the current Dashboard summary
- richer bulk edit fields after owner, priority, and calendar become first-class task fields
- planning adapters for the separately deployed global import/export capability as needed
- spreadsheet-style multi-cell keyboard editing beyond the current keyboard/form alternatives
- module-root frontend source packaging
- activate Operation Graph, shipment, asset, location, and agreement resolvers only when their owning providers expose organization-scoped authorization contracts
