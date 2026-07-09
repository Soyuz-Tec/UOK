# Planning Core Module Plan

**Status:** Active module plan.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`planning.core` provides project planning, task scheduling, dependencies, audit events, and a Gantt workspace as an optional UOK capability module. It must stay integrated with the existing UOK stack and must not become a separate project-management application.

## Stack Contract

- Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL.
- Frontend: React, TypeScript, Vite, CSS design tokens.
- Gantt UI: first-party React, TypeScript, SVG, HTML, and CSS renderer behind a UOK adapter; external Gantt tools may inform feature vocabulary but must not be copied or added as renderer dependencies for this candidate.
- Scheduling logic: Python module service first, with React receiving validated schedule read models.

## Current MVP Scope

Detailed feature inventory and implementation status are tracked in `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md`.

- project list
- project schedule read model
- editable task grid and inspector path for create, update, delete, hierarchy, status, progress, and task type
- traditional Gantt workspace with compact project command bar, Gantt view tab rail, project metadata chips, selection control, grid/timeline, keyboard row navigation, task command toolbar, task row context menu, expand/collapse, cascade sorting, field presets, filters, export, hour/day/week/month/quarter/year scale controls, today/fit/focus controls, critical and baseline toggles, read-model Board/List/Calendar/Workload/People/Dashboard views, and tabbed inspector panels
- Gantt bars
- milestone and summary task model
- dependency create, update, remove with finish-to-start, start-to-start, finish-to-finish, start-to-finish, lag, and lead
- Python scheduling propagation for dependency-driven successor movement
- working calendar storage with working-day and holiday-aware propagation
- hierarchy validation, WBS read model, and summary rollups
- CPM read model fields for early dates, late dates, slack, and critical flags
- baseline capture and baseline variance read-model fields
- resource creation, assignment, allocation display, and over-allocation warnings
- drag-to-reschedule path through server validation
- command-bus writes and idempotency
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
npm --prefix web run build
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

## Deferred Work

- full resource leveling and capacity calendars
- baseline overlay lanes directly inside the Gantt timeline
- richer critical path UX beyond read-model flags and grid fields
- bulk edit, undo, and import/export flows
- richer keyboard grid editing beyond the current inspector workflow
- module-root frontend source packaging
