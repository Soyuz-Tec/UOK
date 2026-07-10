# Planning Core Module Plan

**Status:** Active module plan; Gate A stabilization in progress.

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
- read-only `calendar.core` availability overlay in the project schedule read model for shared busy events and free-busy warnings
- hierarchy validation, WBS read model, and summary rollups
- canonical logic-driven CPM read model fields for early/late dates, total/free float, target variance, and critical flags, with a separate hard-constraint validator
- immutable v2 baseline capture with complete canonical schedule snapshots, SHA-256 verification, source revision/creator/correlation metadata, explicit legacy partial warnings, comparison reads, baseline variance fields, per-row timeline lanes, and variance badges
- resource creation, assignment, allocation display, over-allocation warnings, and explicit resource leveling for later auto-scheduled assigned tasks
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
npm --prefix web run build
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

## Deferred Work

- expand the atomic batch operation registry beyond task updates; unsupported destructive/dependency/calendar/assignment history kinds remain fail closed
- richer resource capacity calendars
- deeper write integration that can publish selected Planning tasks or milestones to `calendar.core` events after user approval
- richer baseline history and comparison controls beyond the current immutable detail/compare API and legacy warning
- richer critical path dependency-chain explanation beyond the current Dashboard summary
- richer bulk edit fields after owner, priority, and calendar become first-class task fields
- planning adapters for the separately deployed global import/export capability as needed
- richer keyboard grid editing beyond the current inspector workflow
- module-root frontend source packaging
