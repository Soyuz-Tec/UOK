# Planning Gantt External Feature Intake

**Status:** Active implementation input.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact records Gantt feature and interaction ideas identified from DHTMLX Gantt and SVAR React Gantt. It is a feature-intake document for UOK-owned `planning.core` work.

This artifact does not permit copying third-party source code, vendoring third-party Gantt renderers, or adding a Gantt dependency. UOK may use these projects only to understand feature vocabulary, common user expectations, and prioritization.

## Sources Reviewed

| Source | Reviewed for | Notes |
|---|---|---|
| `https://github.com/DHTMLX/gantt` | Community feature set, plugin vocabulary, data API ideas, advanced PRO comparison | DHTMLX describes configurable task grids, projects, milestones, four dependency types with lag, drag scheduling, progress bars, templates, plugins, data loading/saving, export, accessibility, touch support, events, and TypeScript definitions. |
| `https://github.com/svar-widgets/react-gantt` | React-first feature vocabulary, large-data concerns, toolbar/context menu ideas, PRO comparison | SVAR describes React/TypeScript support, task and dependency visualization, editable tasks, hierarchy, custom scales, grid sorting/filtering, toolbar/context menu, tooltips, scroll zoom, hotkeys, virtualization, localization, themes, and PRO scheduling features. |

## Intake Rules

- Build only UOK-owned React, TypeScript, SVG, HTML, CSS, and Python scheduling code.
- Keep scheduling authority in Python.
- Keep reusable frontend behavior under `web/src/shared` when it can apply beyond planning.
- Do not copy third-party implementation, CSS, type names as APIs, examples, or branded UI.
- Do not add `dhtmlx-gantt`, `@svar-ui/react-gantt`, or related packages without a new ADR.

## DHTMLX Feature Vocabulary

| Feature idea | UOK status | UOK target |
|---|---:|---|
| Configurable task grid with tree/task column | Partial | Continue first-party grid work: column reorder, pinned columns, inline edit. |
| Projects/summary tasks and milestones | Implemented | Keep summary and milestone rendering first-party. |
| Four dependency types plus lag | Implemented | Keep validation in Python and UI editing in inspector. |
| Drag scheduling and resize | Implemented | Continue server-validated move/resize/progress behavior. |
| Drag-to-create dependency links | Implemented | Taskbar connector handles create finish-to-start links through server validation. |
| Progress bar editing | Implemented | Keep progress drag handle and inspector edits. |
| Lightbox/task editor | Partial | UOK equivalent is the inspector; improve compact edit workflows and inline grid edit. |
| Configurable scales from hour to year | Implemented | UOK-owned hour, day, week, month, quarter, and year modes exist without changing the renderer boundary. |
| Timeline cell templates and task templates | Partial | Use UOK-owned render helpers and status indicators; avoid third-party template API cloning. |
| Tooltips and quick info | Implemented | UOK renders accessible first-party taskbar hover/focus detail. |
| Keyboard navigation | Implemented | Grid rows support arrow/home/end focus movement plus common task hotkeys. |
| Fullscreen mode | Implemented | UOK-owned focus mode expands the planning workspace without invoking third-party fullscreen code. |
| Drag timeline / click-drag new task | Backlog | Add timeline panning and controlled task creation gestures later. |
| Smart rendering / large data performance | Backlog | Add virtualization only after current features stabilize. |
| Data loading/saving and REST sync | Implemented | UOK uses FastAPI read models and command writes, not direct client-owned persistence. |
| Export to document/image/project formats | Partial | CSV exists; PDF/image/import-export templates remain later. |
| Locales/accessibility/touch | Partial | Continue ARIA, focus, and responsive proof; localization remains backlog. |
| Event system | Partial | UOK equivalent is command bus plus planning audit events. |

## SVAR Feature Vocabulary

| Feature idea | UOK status | UOK target |
|---|---:|---|
| React and TypeScript native component model | Implemented | UOK renderer is first-party React and TypeScript. |
| Task and dependency visualization | Implemented | Continue SVG timeline and dependency path improvements. |
| Interactive drag-and-drop editing | Implemented | Keep all edits server-validated. |
| Customizable task edit form | Partial | UOK inspector supports task edit; make forms denser and safer over time. |
| Hierarchical subtasks | Implemented | Summary hierarchy and collapse/expand exist. |
| Configurable scales including hours/minutes/sprints/stages | Partial | Hour mode exists; minutes, sprints, and stages remain UOK-specific backlog. |
| Customizable grid columns | Implemented | Field presets, visibility, resize, and autofit exist. |
| Grid sorting and task filtering | Partial | Search/filter implemented; richer column sorting remains. |
| Toolbar and context menu | Implemented | Toolbar and task row context menu exist with server-routed planning actions. |
| Taskbar tooltips | Implemented | UOK-owned hover/focus task detail is rendered in the SVG timeline. |
| Zooming with scroll | Backlog | Add controlled wheel/trackpad zoom without breaking page scroll. |
| Hotkeys | Implemented | Common task actions can be triggered from focused Gantt rows. |
| Virtualization for large data sets | Backlog | Add only with measurable performance need and tests. |
| Localization | Backlog | Requires UOK-wide localization approach, not planning-only strings. |
| Light/dark themes | Implemented | UOK appearance tokens and UI proof cover light/dark behavior. |
| Work-time calendars and resource calendars | Partial | Calendar-aware scheduling exists partially; resource calendars remain backlog. |
| Critical path, slack, baselines | Partial | CPM read model exists; richer UX and baseline lanes remain. |
| Resource planning and workload | Partial | Resource assignment and warnings exist; workload visualization can mature. |
| Task grouping, rollups, split tasks, unscheduled tasks | Backlog | Add only after core dependency/constraint model is stronger. |
| Undo/redo | Backlog | Needs command stack with server reconciliation. |
| Export/import | Partial | CSV exists; PDF/image/Excel/MS Project equivalents remain later. |

## Detailed Feature And Property Catalog

This table turns the external feature vocabulary into UOK-owned build units. It names the expected properties and UI elements without adopting third-party APIs or source code.

| Capability family | Feature/function | Typical properties/elements to model | UOK implementation target | Status |
|---|---|---|---|---:|
| Workspace shell | Fullscreen/focus workspace | toolbar toggle, pressed state, viewport overlay, exit action, preserved scrollable toolbar | Local `planning.core` focus mode with saved-view persistence | Implemented |
| Workspace shell | Multiple chart instances | isolated project id, selected view state, independent scroll/zoom state | Keep each planning route instance isolated by project and local storage keys | Partial |
| Workspace shell | View switching | Gantt, board, list, calendar, workload, people, dashboard | Existing read-model tabs from one validated schedule | Implemented |
| Grid | Configurable columns | id, label, width, min/max width, visibility, preset, resize/autofit, eventual order/pin flags | Shared table sizing/visibility primitives plus planning-specific field presets | Partial |
| Grid | Tree column | WBS code, indentation, summary marker, expand/collapse state, parent id | Summary rows and WBS sorting; richer per-parent expand state later | Partial |
| Grid | Inline cell editing | editable field, validation state, commit/cancel, keyboard handling, server command | Defer until command-level validation and audit messages are tighter | Backlog |
| Grid | Column sorting/filtering | column id, direction, filter mode, query, status/resource criteria | Search/filter exists; richer column sort remains | Partial |
| Timeline | Time scales | scale id, unit, step, label, group label, cell width, zoom order | Hour/day/week/month/quarter/year scale model | Implemented |
| Timeline | Timeline templates | header label, cell class, task shape class, weekend/holiday class | UOK-owned render helpers and CSS tokens | Partial |
| Timeline | Markers | today, milestones, deadlines, vertical event markers | Today marker exists; deadline/event markers later | Partial |
| Timeline | Drag timeline and scroll zoom | pointer panning, wheel modifier, scale bounds, scroll preservation | Add after current controls stabilize | Backlog |
| Tasks | Task types | task, summary/project, milestone, unscheduled, split segment, rollup | Task/summary/milestone exist; unscheduled/split/rollup later | Partial |
| Tasks | Taskbar editing | move, resize start/end, progress drag, dependency handles | Implemented through first-party SVG with server validation | Implemented |
| Tasks | Task status presentation | status code, color token, non-color label, critical flag, selected/focus state | Implemented for bars and grid rows | Implemented |
| Tasks | Quick info/tooltips | title, WBS, status, progress, start/end, assignee, dependency hints | First-party hover/focus task detail | Implemented |
| Editing | Lightbox/edit form | modal or side panel, title, dates, progress, parent, type, status, resources | UOK inspector path; compact edit improvements later | Partial |
| Dependencies | Link model | predecessor, successor, type, lag/lead, validation errors, cycle checks | Python-owned validation with inspector and drag-link UI | Implemented |
| Dependencies | Chain highlighting | predecessor/successor path, selected task emphasis, critical chain | Future selected-chain overlay | Backlog |
| Scheduling | Auto scheduling | dependency propagation, calendar rules, manual/auto mode, constraints | Partial Python propagation; constraints/manual mode later | Partial |
| Scheduling | CPM and slack | early/late dates, total slack, critical flag, variance | CPM read model exists; richer visual explanation later | Partial |
| Scheduling | Calendars | working days, holidays, resource calendars, ignored/non-linear periods | Working days/holidays partially implemented | Partial |
| Resources | Assignments | resource id/name, role, allocation, capacity, warnings, workload lane | Assignments and warnings exist; workload visualization matures later | Partial |
| Baselines | Baseline overlays | baseline start/end, variance, baseline lane, deadline marker | Capture and row overlay exist; richer lane later | Partial |
| Performance | Smart rendering/virtualization | visible row window, visible column/window, stable row heights, overscan | Defer until data scale requires it and proof covers it | Backlog |
| Accessibility | Keyboard/touch/ARIA | row navigation, focus rings, button labels, touch target size, non-color cues | Keyboard and ARIA proof exists; touch/localization later | Partial |
| Data integration | REST sync and events | read model, command write, audit event, optimistic state rules | UOK command bus and audit events, no client-owned persistence | Implemented |
| Export/import | Output formats | visible CSV, PDF/image, Excel, project exchange, import validation | CSV exists; document/image/project export later | Partial |
| History | Undo/redo | command stack, reversible payload, server reconciliation, audit correlation | Needs explicit command-stack design | Backlog |

## Near-Term UOK Implementation Order

1. Taskbar hover/focus details: low-risk visible polish from both projects; can be implemented in the current first-party SVG renderer.
2. Dependency drag creation: implemented with taskbar connector handles and the existing Python-validated dependency API.
3. Context row menu: implemented with a reusable workspace context menu primitive and planning task actions.
4. Keyboard hotkeys and focus movement: implemented for Gantt grid row navigation and common task actions.
5. Additional scales: hour, quarter, and year implemented; later minutes, sprints, and stages remain backlog.
6. Fullscreen/focus mode: implemented as a UOK-owned dense workspace overlay with saved-view persistence.
7. Column reorder and pinned columns: continue grid maturity using shared table primitives.
8. Virtualization and timeline panning: performance work after feature behavior stabilizes.

## Validation

Feature slices from this intake must pass the relevant local checks:

```powershell
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
