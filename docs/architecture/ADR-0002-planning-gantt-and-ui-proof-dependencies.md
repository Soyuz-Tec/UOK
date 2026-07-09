# ADR-0002: Planning Gantt And UI Proof Dependencies

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK needs an integrated Gantt capability without changing the accepted software stack. The backend stack remains Python, FastAPI, Pydantic, SQLAlchemy, and PostgreSQL. The frontend stack remains React, TypeScript, Vite, and CSS design tokens. Scheduling authority must stay in the Python module service so React receives validated schedule read models.

The frontend also needs repeatable runtime proof for module workspaces because source checks alone do not prove rendering quality, keyboard behavior, appearance switching, responsive layout, or console cleanliness.

## Decision

Build the first Gantt release as `planning.core`, an optional capability module inside the existing modular monolith. Do not add Next.js, server-rendered React, a Node backend, or a separate project-management subsystem.

Use a first-party UOK `PlanningGantt` renderer for the first release. External Gantt products and open-source libraries may be studied for feature vocabulary, interaction expectations, and risk analysis, but UOK must not vendor, copy, or depend on third-party Gantt code for this candidate. The renderer stays behind the UOK adapter boundary and uses React, TypeScript, SVG, HTML tables, and CSS design tokens.

Use `@playwright/test` as the UI proof runner. Add `npm --prefix web run test:ui-proof` and `scripts/uok_ops.ps1 -Action UiProof` as repeatable gates.

## Consequences

- Python remains the scheduling authority for project, task, dependency, and reschedule validation.
- React renders validated read models and sends changes back to Python before accepting state.
- The Gantt renderer is isolated behind a feature adapter, so a future DHTMLX, Bryntum, Frappe, SVAR, or custom canvas replacement does not leak across the workbench if a later ADR approves a third-party engine.
- UOK owns the task grid, timeline scale, bars, milestones, dependency lines, today marker, baseline marks, field presets, filters, view tabs, and drag-to-reschedule callback path.
- UI proof automation becomes part of `Verify`, increasing local verification time but reducing visual and interaction drift.

## Alternatives

- Use `@svar-ui/react-gantt`: superseded for this candidate because the user requested a UOK-owned implementation that learns from external feature sets without adding third-party Gantt code.
- Hand-roll the Gantt: accepted for this candidate after reducing scope to a UOK-owned renderer with server-validated scheduling, focused UI proof, and a replaceable adapter boundary.
- Add a Node scheduling service: rejected because it violates the accepted backend stack and splits scheduling authority.
- Add DHTMLX or Bryntum immediately: deferred because commercial licensing and professional scheduling depth are not required for the first release.
- Use Frappe Gantt directly: rejected for this candidate because the user requested no third-party Gantt code. Frappe remains useful research input for feature vocabulary such as custom views, ignored periods, readonly modes, dependency movement, and public chart methods.

## Validation

Required checks:

```powershell
python -m pytest modules/planning.core/tests/test_planning_core.py -q
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
