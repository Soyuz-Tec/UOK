# Planning Gantt Feature Catalog

**Status:** Active implementation catalog.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact catalogs the Gantt chart features UOK has identified from common professional Gantt applications and open-source Gantt libraries. It is a build map for `planning.core`; it is not permission to copy third-party source code or add third-party Gantt renderers.

UOK must implement these features as first-party React, TypeScript, SVG, HTML, CSS, and Python scheduling code. External tools may inform feature vocabulary and user expectations only.

## Implementation Rules

- Scheduling authority stays in Python.
- React renders validated schedule read models and sends proposed changes back to Python.
- Shared UI behavior belongs in `web/src/shared` when it can serve other modules.
- Planning-specific behavior belongs in `web/src/features/planning` or `modules/planning.core`.
- Use Python standard library primitives first for scheduling internals: `datetime`, `calendar`, `zoneinfo`, `graphlib.TopologicalSorter`, `csv`, and `json`.
- Do not add a Python, JavaScript, or CSS Gantt chart dependency without a new ADR.
- Verify source size after each implementation slice.

## Current Implemented Foundation

| Area | Status | Current UOK behavior |
|---|---:|---|
| First-party renderer | Implemented | Owned React/SVG/HTML/CSS Gantt renderer behind `PlanningGantt`. |
| Project picker and metadata | Implemented | Project selector, status chip, owner chip placeholder, favorite control. |
| View tabs | Implemented | Gantt, Board, List, Calendar, Workload, People, Dashboard. |
| Task creation commands | Implemented | Task and milestone creation routes through inspector/API flow. |
| Dependencies | Implemented | Create/update/remove in inspector; dependency lines render in Gantt. |
| Dependency types | Implemented | Finish-to-start, start-to-start, finish-to-finish, start-to-finish, lag/lead in backend model. |
| Drag-to-reschedule | Implemented | Bar drag proposes date shift and calls server validation path. |
| Summary tasks and WBS | Implemented | Summary rows, WBS sorting, hierarchy validation, collapse/expand controls. |
| Milestones | Implemented | Milestone task type and diamond rendering. |
| Baselines | Partial | Baseline capture and variance fields exist; baseline marks render on task rows. |
| Critical path | Partial | Critical flags and highlighting exist; richer chain explanation remains. |
| Calendars | Partial | Working days and holidays exist; holiday shading is visible. |
| Resources | Partial | Resource creation, assignment, allocation display, and warnings exist. |
| Export | Partial | CSV export exists for visible schedule. |
| UI proof | Implemented | Playwright proof covers rendering, controls, inspector tabs, responsiveness, and console cleanliness. |

## Grid And Column Features

| Feature | Target behavior | Status |
|---|---|---:|
| Resizable columns | Drag column separator to adjust width; keyboard arrows resize; widths persist locally. | Implemented |
| Auto-fit columns | Double-click column resize handle/header to fit visible content. | Implemented |
| Shared column resize primitive | Contacts and Planning use shared resize handle/sizing hook instead of local copies. | Implemented |
| Field presets | Core, Progress, and Resources column sets. | Implemented |
| Column visibility | User-selectable individual columns beyond presets. | Backlog |
| Column reorder | Drag headers to reorder columns. | Backlog |
| Pinned columns | Keep WBS/task visible while timeline scrolls. | Backlog |
| Sort by columns | Sort by WBS, date, status, assignee, progress, and priority. | Partial |
| Inline grid edit | Edit task cells directly in grid with server validation. | Backlog |
| Context row menu | Add below, add child, duplicate, delete, convert to milestone, color/status actions. | Backlog |

## Row And Density Features

| Feature | Target behavior | Status |
|---|---|---:|
| Compact/standard/roomy density | Toolbar-controlled row height modes. | Implemented |
| Double-click task header to shorten rows | Double-click Task header toggles compact/standard density. | Implemented |
| Double-click summary row | Double-click summary row toggles global expand/collapse. | Implemented |
| Per-row height | Resize individual rows by dragging row bottom edge. | Backlog |
| Auto-height row fit | Fit selected row to content without layout overlap. | Backlog |
| Scroll synchronization | Grid and timeline row alignment must remain stable. | Implemented |

## Timeline Features

| Feature | Target behavior | Status |
|---|---|---:|
| Day/week/month scale | Toolbar scale controls and zoom slider. | Implemented |
| Today marker | Current date marker and scroll-to-today command. | Implemented |
| Fit project | Fit to month/project range. | Partial |
| Weekend shading | Non-working weekend visual bands. | Implemented |
| Holiday shading | Calendar holiday visual bands. | Implemented |
| Hour/quarter/year scales | Additional scale modes. | Backlog |
| Timeline header grouping | Month/year/week grouping. | Implemented |
| Ignored periods | Exclude configured periods from progress/date calculations. | Backlog |

## Task Shape And Color Features

| Feature | Target behavior | Status |
|---|---|---:|
| Normal task bars | Render start/end duration bars. | Implemented |
| Summary bars | Render phase/summary bars distinctly. | Implemented |
| Milestone diamonds | Render zero-duration milestones. | Implemented |
| Progress overlay | Inner progress fill shows completion percentage. | Implemented |
| Status color coding | Not started, in progress, complete, overdue, blocked, critical. | Implemented |
| Non-color indicators | Labels/icons/patterns so status does not depend on color alone. | Backlog |
| Selected/hover/focus states | Visible selected and keyboard focus states. | Partial |
| Resize start/end handles | Drag bar edges to change duration. | Implemented |
| Progress drag handle | Drag progress handle to update percent through server validation. | Implemented |

## Dependency Features

| Feature | Target behavior | Status |
|---|---|---:|
| Dependency display | Draw connector paths between visible predecessor/successor tasks. | Implemented |
| Dependency inspector | Create/update/remove dependency records. | Implemented |
| Dependency lag/lead | Positive lag and negative lead. | Implemented |
| Dependency validation | Reject missing refs, self-links, cycles, and invalid date order. | Implemented |
| Dependency drag creation | Drag from one task to another to link tasks. | Backlog |
| Highlight chain | Show selected task predecessors and successors. | Backlog |
| Cascade scheduling toggle | Move successors when predecessor dates change. | Partial |

## Scheduling And Python Features

| Feature | Target behavior | Status |
|---|---|---:|
| Server-side validation | Python validates all schedule mutations before UI accepts them. | Implemented |
| Topological ordering | Use dependency graph ordering for propagation and cycle checks. | Partial |
| CPM read model | Early/late dates, total slack, critical flags. | Implemented |
| Calendar-aware propagation | Respect working days and holidays. | Partial |
| Resource over-allocation | Warn when allocation exceeds capacity. | Implemented |
| Resource leveling | Automatically adjust schedule to resolve allocation conflicts. | Backlog |
| Constraints | Must-start, must-finish, no-earlier-than, no-later-than. | Backlog |
| Manual/auto scheduling | Per-task scheduling mode. | Backlog |

## Workspace And Professional Features

| Feature | Target behavior | Status |
|---|---|---:|
| Board/List/Calendar/Workload/People/Dashboard views | Alternate read-model views from same validated schedule. | Implemented |
| Bulk selection | Select visible rows and apply safe bulk actions. | Partial |
| Bulk edit | Change status, owner, dates, priority, or calendar for selected tasks. | Backlog |
| Undo/redo | Reversible local command stack with server reconciliation. | Backlog |
| Saved views | Store filters, density, fields, scale, and grouping. | Backlog |
| Search/filter/group | Search task titles; filter by status, critical, resource, milestone. | Partial |
| Export | CSV now; later PDF/image/import template. | Partial |
| Audit history | Planning schedule events are recorded. | Implemented |

## Validation

Before marking a feature slice complete, run the narrow relevant checks and then the broader gate when runtime behavior changes:

```powershell
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:ui-proof
python -m pytest modules/planning.core/tests/test_planning_core.py -q
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

For user-facing runtime changes, rebuild and smoke the local candidate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```
