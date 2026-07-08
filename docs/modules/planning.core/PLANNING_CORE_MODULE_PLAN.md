# Planning Core Module Plan

**Status:** Active module plan.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

`planning.core` provides project planning, task scheduling, dependencies, audit events, and a Gantt workspace as an optional UOK capability module. It must stay integrated with the existing UOK stack and must not become a separate project-management application.

## Stack Contract

- Backend: Python, FastAPI, Pydantic, SQLAlchemy, PostgreSQL.
- Frontend: React, TypeScript, Vite, CSS design tokens.
- Gantt UI: React Gantt library wrapped behind a UOK adapter.
- Scheduling logic: Python module service first, with React receiving validated schedule read models.

## Current MVP Scope

- project list
- project schedule read model
- task grid
- Gantt bars
- milestone-ready task model
- finish-to-start dependencies
- drag-to-reschedule path through server validation
- command-bus writes and idempotency
- planning audit events
- manifest-declared API router, command handlers, command permissions, role grants, dashboard provider, evidence provider, model exports, and candidate verifier
- Playwright UI proof for Gantt rendering, keyboard focus, appearance, responsive layout, screenshot nonblank checks, and console cleanliness

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

The first release validates:

- required dates
- end date on or after start date
- dependency references inside the project
- self-dependency rejection
- finish-to-start date ordering
- cycle detection

## Acceptance Checks

Required checks before handoff:

```powershell
python -m pytest modules/planning.core/tests/test_planning_core.py -q
npm --prefix web run build:static
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

## Deferred Work

- calendar exception rules in scheduling calculations
- baselines in the Gantt view
- resource loading
- multiple dependency types
- critical path UX beyond initial read-model flagging
- module-root frontend source packaging
