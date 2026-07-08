# ADR-0002: Planning Gantt And UI Proof Dependencies

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK needs an integrated Gantt capability without changing the accepted software stack. The backend stack remains Python, FastAPI, Pydantic, SQLAlchemy, and PostgreSQL. The frontend stack remains React, TypeScript, Vite, and CSS design tokens. Scheduling authority must stay in the Python module service so React receives validated schedule read models.

The frontend also needs repeatable runtime proof for module workspaces because source checks alone do not prove rendering quality, keyboard behavior, appearance switching, responsive layout, or console cleanliness.

## Decision

Build the first Gantt release as `planning.core`, an optional capability module inside the existing modular monolith. Do not add Next.js, server-rendered React, a Node backend, or a separate project-management subsystem.

Use `@svar-ui/react-gantt` behind the UOK `PlanningGantt` adapter for the first release. The package is MIT licensed, supports React peers, and keeps the Gantt UI inside the existing React/Vite frontend.

Use `@playwright/test` as the UI proof runner. Add `npm --prefix web run test:ui-proof` and `scripts/uok_ops.ps1 -Action UiProof` as repeatable gates.

## Consequences

- Python remains the scheduling authority for project, task, dependency, and reschedule validation.
- React renders validated read models and sends changes back to Python before accepting state.
- The Gantt library is isolated behind a feature adapter, so a future DHTMLX, Bryntum, Frappe, or custom canvas replacement does not leak across the workbench.
- UI proof automation becomes part of `Verify`, increasing local verification time but reducing visual and interaction drift.

## Alternatives

- Hand-roll the Gantt: rejected for the MVP because timeline rendering, drag behavior, and dependency visuals are non-trivial and would create avoidable UI risk.
- Add a Node scheduling service: rejected because it violates the accepted backend stack and splits scheduling authority.
- Add DHTMLX or Bryntum immediately: deferred because commercial licensing and professional scheduling depth are not required for the first release.
- Use Frappe Gantt directly: deferred because the React integration and accessibility review would need more adapter work than SVAR for this release.

## Validation

Required checks:

```powershell
python -m pytest modules/planning.core/tests/test_planning_core.py -q
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
