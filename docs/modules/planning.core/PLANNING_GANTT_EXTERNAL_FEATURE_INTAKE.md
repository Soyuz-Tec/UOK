# Planning Gantt External Feature Intake

**Status:** Active implementation input.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact records Gantt feature and interaction ideas identified from DHTMLX Gantt and SVAR React Gantt. It is a feature-intake document for UOK-owned `planning.core` work.

This artifact does not permit copying third-party source code, vendoring third-party Gantt renderers, or adding a Gantt dependency. UOK may use these projects only to understand feature vocabulary, common user expectations, and prioritization.

## Sources Reviewed

| Source | Reviewed for | Notes |
|---|---|---|
| `https://github.com/DHTMLX/gantt` | Community feature set, plugin vocabulary, sample gallery, data API ideas, advanced PRO comparison | Snapshot `e5ea07b` verified on 2026-07-09. DHTMLX describes configurable task grids, projects, milestones, four dependency types with lag, drag scheduling, progress bars, templates, plugins, data loading/saving, export, accessibility, touch support, events, TypeScript definitions, and many sample-level feature variants. |
| `https://github.com/svar-widgets/react-gantt` | React-first feature vocabulary, public type surface, demo gallery, large-data concerns, toolbar/context menu ideas, PRO comparison | Snapshot `8ce2cde` verified on 2026-07-09. SVAR describes React/TypeScript support, task and dependency visualization, editable tasks, hierarchy, custom scales, grid sorting/filtering, toolbar/context menu, tooltips, scroll zoom, hotkeys, virtualization, localization, themes, and PRO scheduling features. |

## Intake Rules

- Build only UOK-owned React, TypeScript, SVG, HTML, CSS, and Python scheduling code.
- Keep scheduling authority in Python.
- Keep reusable frontend behavior under `web/src/shared` when it can apply beyond planning.
- Do not copy third-party implementation, CSS, type names as APIs, examples, or branded UI.
- Do not add `dhtmlx-gantt`, `@svar-ui/react-gantt`, or related packages without a new ADR.

## DHTMLX Feature Vocabulary

| Feature idea | UOK status | UOK target |
|---|---:|---|
| Configurable task grid with tree/task column | Implemented | First-party grid supports pinned WBS/task columns plus inline edits for core mutable task fields. |
| Projects/summary tasks and milestones | Implemented | Keep summary and milestone rendering first-party. |
| Four dependency types plus lag | Implemented | Keep validation in Python and UI editing in inspector. |
| Drag scheduling and resize | Implemented | Continue server-validated move/resize/progress behavior. |
| Drag-to-create dependency links | Implemented | Taskbar connector handles create finish-to-start links through server validation. |
| Progress bar editing | Implemented | Keep progress drag handle and inspector edits. |
| Lightbox/task editor | Partial | UOK equivalent is the inspector plus inline grid edits for title, dates, status, and progress; richer compact edit flows remain later. |
| Configurable scales from hour to year | Implemented | UOK-owned hour, day, week, month, quarter, and year modes exist without changing the renderer boundary. |
| Timeline cell templates and task templates | Partial | Use UOK-owned render helpers and status indicators; avoid third-party template API cloning. |
| Tooltips and quick info | Implemented | UOK renders accessible first-party taskbar hover/focus detail. |
| Keyboard navigation | Implemented | Grid rows support arrow/home/end focus movement plus common task hotkeys. |
| Fullscreen mode | Implemented | UOK-owned focus mode expands the planning workspace without invoking third-party fullscreen code. |
| Drag timeline / click-drag new task | Implemented | Timeline panning, Ctrl/Command wheel zoom, and Shift-drag empty-space task creation are implemented through UOK-owned interactions. |
| Smart rendering / large data performance | Backlog | Add virtualization only after current features stabilize. |
| Data loading/saving and REST sync | Implemented | UOK uses FastAPI read models and command writes, not direct client-owned persistence. |
| Export to document/image/project formats | Partial | CSV exists; PDF/image/import-export templates remain later. |
| Locales/accessibility/touch | Partial | Continue ARIA, focus, and responsive proof; localization remains backlog. |
| Event system | Partial | UOK equivalent is command bus plus planning audit events. |
| Row resize | Implemented | UOK row-height model supports per-project row overrides, drag/keyboard resize handles, and double-click/Enter row fit without third-party code. |
| Drag rows / branch ordering | Backlog | Add WBS reorder only after hierarchy command validation is explicit. |
| Right-side grid columns / no-grid mode / bottom scale / RTL | Partial | Timeline-only no-grid mode is implemented; right-side grid, bottom scale, and RTL remain later layout variants. |
| Backward planning and fixed project dates | Backlog | Requires constraint model and explicit scheduling direction. |
| Empty-state screen | Implemented | First-party grid and timeline empty state appears when filters or a project leave no visible tasks. |
| Deadline/event markers | Partial | Project start/end markers plus derived visible-task due, variance, and milestone markers are implemented; arbitrary user event markers remain later. |
| Import from Excel/MS Project/Primavera/iCal | Backlog | Requires validated server import pipeline and no external service dependency. |

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
| Grid sorting and task filtering | Implemented | Search/filter plus visible-column sorting are implemented for current field presets. |
| Toolbar and context menu | Implemented | Toolbar and task row context menu exist with server-routed planning actions. |
| Taskbar tooltips | Implemented | UOK-owned hover/focus task detail is rendered in the SVG timeline. |
| Zooming with scroll | Implemented | Ctrl/Command wheel uses the existing UOK scale model while ordinary scrolling remains native. |
| Hotkeys | Implemented | Common task actions can be triggered from focused Gantt rows. |
| Virtualization for large data sets | Backlog | Add only with measurable performance need and tests. |
| Localization | Backlog | Requires UOK-wide localization approach, not planning-only strings. |
| Light/dark themes | Implemented | UOK appearance tokens and UI proof cover light/dark behavior. |
| Work-time calendars and resource calendars | Partial | Calendar-aware scheduling exists partially; resource calendars remain backlog. |
| Critical path, slack, baselines | Partial | CPM read model exists; richer UX and baseline lanes remain. |
| Resource planning and workload | Implemented | Resource assignment, warnings, and first-party daily workload lanes exist; automatic leveling remains a separate scheduling backlog item. |
| Task grouping, rollups, split tasks, unscheduled tasks | Backlog | Add only after core dependency/constraint model is stronger. |
| Undo/redo | Backlog | Needs command stack with server reconciliation. |
| Export/import | Partial | CSV exists; PDF/image/Excel/MS Project equivalents remain later. |
| Header menu for visible columns | Implemented | UOK now has a first-party per-column header menu for sort, quick action, width reset, hide, and show-all column controls. |
| No-grid and read-only/prevent-actions modes | Implemented | Timeline-only no-grid mode and review/edit mode are implemented; deeper role-derived permission policy remains a future authorization layer. |
| Custom task templates and cell borders | Partial | UOK owns task/status templates and timeline grid borders through CSS tokens. |
| Scroll to date / custom zoom / min scale unit | Partial | Scroll-to-today, scroll-to-selected-task, arbitrary date navigation, project-fit navigation, and scale controls exist; custom zoom bounds remain later. |
| Editor validation, readonly editor, comments, custom controls | Partial | Inspector validation exists; comments and editor modes remain module backlog. |
| Start/end date display variants and duration units | Partial | Current schedule is date-based; hour/minute duration editing is later. |

## Detailed Feature And Property Catalog

This table turns the external feature vocabulary into UOK-owned build units. It names the expected properties and UI elements without adopting third-party APIs or source code.

## Source-Derived Property And Element Matrix

These are the implementation-neutral ideas UOK should model in its own schemas, read models, components, and CSS tokens. Names below describe capability concepts, not third-party API names to import or clone.

| Area | Feature/function ideas | Properties to model in UOK | Visible/control elements |
|---|---|---|---|
| Task data | Task, summary/project, milestone, unscheduled, split segment, rollup | `id`, `title`, `task_type`, `parent_task_id`, `start`, `end`, `duration_days`, `progress`, `status`, `sort_order`, `wbs`, `open/collapsed`, `baseline`, `deadline`, `constraint`, `manual/auto`, `calendar_id`, `resource_ids` | Grid rows, tree indentation, summary bars, normal bars, milestone diamonds, rollup markers, status badges |
| Dependency data | FS, SS, FF, SF links; lag/lead; drag-created links | `predecessor_task_id`, `successor_task_id`, `dependency_type`, `lag_days`, validation state, chain membership, critical membership | Connector lines, link handles, draft link line, dependency editor rows, invalid-link message |
| Grid configuration | Tree column, task column, add/action column, custom fields, inline editing, sorting, filtering, resizing, pinned columns | column id, label, field, width, min/max, pinned, visible, order, align, formatter, editable, sort direction, filter criteria | Header row, resize handles, field visibility menu, header menu, action column, inline cell editor, row context menu |
| Timeline scale | Single/dual headers, hour/day/week/month/quarter/year, custom steps, sprint/stage/minute variants | scale id, unit, step, label format, group label, cell width, min/max zoom, fit mode, date range | Header bands, zoom slider, scale segmented control, fit/today/selected commands, weekend/holiday cells |
| Timeline markers | Today line, deadlines, vertical events, project bounds, external milestones | marker id, date, label, kind, severity, visibility, clipping behavior | Vertical line, marker label/code, derived task marker flags, edge/offscreen indicator later, tooltip |
| Editing interactions | Move, resize start/end, progress drag, click-drag task creation, dependency drag, row drag, multi-task drag | drag mode, pointer id, source row, target row, proposed start/end, proposed progress, validation result, optimistic/draft state | Task handles, progress knob, draft task rectangle, draft dependency line, drop indicator, disabled/read-only state |
| Editors | Lightbox or side inspector, quick info, custom fields, comments, readonly forms | selected task id, editor mode, dirty fields, validation messages, field schema, custom fields, comment count | Inspector tabs, compact quick info, modal/popup later, save/delete commands, inline validation text |
| Templates/rendering | Custom task bars, grid cells, scale cells, tooltips, skins/themes | render kind, semantic status, critical flag, baseline variance, custom class/token, high contrast state | UOK-owned SVG shapes, CSS token classes, tooltip, non-color status code |
| Navigation | Drag timeline, wheel zoom, scroll-to-date, scroll-to-task, fullscreen/focus, multiple independent instances | scroll left/top, selected task id, date target, zoom state, focus mode, instance storage key | Timeline pan cursor, Today button, Selected button, Focus button, per-project saved view |
| Data sync/events | JSON loading, REST sync, event hooks, lifecycle callbacks, batch updates | command type, command id, actor, audit event, rollback state, read-model version, validation warnings | Bulk completion command, status panel, audit/event log later, command result messages |
| Performance | Smart rendering, virtualization, lazy loading, dynamic loading, large data mode | visible row window, visible time window, overscan, row height, total counts, loading boundary | Virtualized rows, loading placeholder, stable scrollbars, large-schedule proof |
| Accessibility/localization | WAI-ARIA, keyboard navigation, hotkeys, touch support, 32/localized labels, RTL | aria labels, focus target, keyboard command map, locale id, text direction, date/number format | Focus rings, keyboard row movement, translated labels later, touch-sized handles |
| Export/import | PDF, PNG, Excel, iCal, MS Project, CSV, import validation | export format, visible fields, date range, import row mapping, validation summary | Export menu, import wizard later, downloaded artifact status |
| Advanced scheduling | Auto-schedule, critical path, slack, calendars, constraints, resource planning, workload, backward planning, undo/redo | dependency graph, calendar, resource capacity, slack, constraint type/date, scheduling direction, undo command stack | Critical overlays, workload lane, constraint indicators, undo/redo buttons later |

| Capability family | Feature/function | Typical properties/elements to model | UOK implementation target | Status |
|---|---|---|---|---:|
| Workspace shell | Fullscreen/focus workspace | toolbar toggle, pressed state, viewport overlay, exit action, preserved scrollable toolbar | Local `planning.core` focus mode with saved-view persistence | Implemented |
| Workspace shell | Multiple chart instances | isolated project id, selected view state, independent scroll/zoom state | Keep each planning route instance isolated by project and local storage keys | Partial |
| Workspace shell | View switching | Gantt, board, list, calendar, workload, people, dashboard | Existing read-model tabs from one validated schedule | Implemented |
| Grid | Configurable columns | id, label, width, min/max width, visibility, preset, resize/autofit, order, pin flags | Shared table sizing/visibility/order primitives plus planning-specific pinned columns | Partial |
| Grid | Header menu | column id, checked state, hide/show action, reset widths, sort action, keyboard access | First-party per-column menu complements field controls and shared column primitives | Implemented |
| Grid | Add-task/action column | command button, row action menu, add child/add below, disabled/read-only states | Row menu exists; add-column control later if density allows | Partial |
| Grid | Tree column | WBS code, indentation, summary marker, expand/collapse state, parent id | Summary rows, WBS sorting, and accessible per-summary expand/collapse controls with nested descendant hiding | Implemented |
| Grid | Inline cell editing | editable field, validation state, commit/cancel, keyboard handling, server command | Title, start, end, progress, and status cells use shared inline editing and existing server task validation | Implemented |
| Grid | Column sorting/filtering | column id, direction, filter mode, query, status/resource criteria | Search/filter and visible-column sorting use UOK-owned read-model helpers | Implemented |
| Grid | Branch ordering / row drag | dragged task id, drop parent, before/after mode, valid WBS target, audit event | Later WBS reorder command with Python validation | Backlog |
| Grid | Row resize | row id, height, min/max, global density fallback, persisted override | First-party row-height helper, row-bottom separators, keyboard resize, and proof tests | Implemented |
| Timeline | Time scales | scale id, unit, step, label, group label, cell width, zoom order | Hour/day/week/month/quarter/year scale model | Implemented |
| Timeline | Timeline templates | header label, cell class, task shape class, weekend/holiday class | UOK-owned render helpers and CSS tokens | Partial |
| Timeline | Markers | today, project bounds, milestones, deadlines, vertical event markers | Today, project boundary markers, and derived visible-task due/variance/milestone markers exist; arbitrary user event markers remain later | Partial |
| Timeline | Drag timeline and scroll zoom | pointer panning, wheel modifier, scale bounds, scroll preservation | Empty-space panning, Ctrl/Command wheel scale stepping, and Shift-drag task creation are implemented | Implemented |
| Timeline | Zoom-to-fit and scroll-to-date | project range, selected date, today, viewport width, scale bounds | Today, selected task, arbitrary date target, and project-fit commands exist; custom zoom bounds remain later | Partial |
| Timeline | Layout modes | grid left/right/hidden, scale top/bottom, RTL, fixed size/autosize | Timeline-only hidden-grid mode is implemented and saved with planning views | Partial |
| Tasks | Task types | task, summary/project, milestone, unscheduled, split segment, rollup | Task/summary/milestone exist; unscheduled/split/rollup later | Partial |
| Tasks | Taskbar editing | move, resize start/end, progress drag, dependency handles | Implemented through first-party SVG with server validation | Implemented |
| Tasks | Task status presentation | status code, color token, non-color label, critical flag, selected/focus state | Implemented for bars and grid rows | Implemented |
| Tasks | Quick info/tooltips | title, WBS, status, progress, start/end, assignee, dependency hints | First-party hover/focus task detail | Implemented |
| Tasks | Read-only/prevent-actions mode | permission flag, disabled drag handles, disabled context actions, review-only labels | Review mode disables schedule mutation controls, chart edit handles, dependency handles, context actions, and inspector editor controls | Implemented |
| Tasks | Deadline and outside-timescale handling | deadline date, warning marker, clipped label, offscreen indicator | Derived visible-task marker flags exist; clipped/offscreen indicator model remains later | Partial |
| Editing | Lightbox/edit form | modal or side panel, title, dates, progress, parent, type, status, resources | UOK inspector path; compact edit improvements later | Partial |
| Editing | Comments and custom controls | task comment thread, custom fields, validation messages, read-only fields | Later after module comments/custom fields are designed | Backlog |
| Dependencies | Link model | predecessor, successor, type, lag/lead, validation errors, cycle checks | Python-owned validation with inspector and drag-link UI | Implemented |
| Dependencies | Chain highlighting | predecessor/successor path, selected task emphasis, critical chain | Selected predecessor/successor rows, task bars, and dependency paths highlight in the first-party renderer | Implemented |
| Scheduling | Auto scheduling | dependency propagation, calendar rules, manual/auto mode, constraints | Partial Python propagation; constraints/manual mode later | Partial |
| Scheduling | CPM and slack | early/late dates, total slack, critical flag, variance | CPM read model exists; richer visual explanation later | Partial |
| Scheduling | Calendars | working days, holidays, resource calendars, ignored/non-linear periods | Working days/holidays partially implemented | Partial |
| Scheduling | Backward planning and fixed project limits | direction, project start/end bounds, constraint violation messages | Later Python scheduling policy extension | Backlog |
| Resources | Assignments | resource id/name, role, allocation, capacity, warnings, workload lane | Assignments, warnings, and workload lanes are implemented from the validated schedule read model | Implemented |
| Resources | Resource panel/load chart | resource row, load cell, chart mode, allocation template, overload state | First-party Workload view renders resource lanes, daily allocation cells, peak load, and overload status from existing assignments | Implemented |
| Baselines | Baseline overlays | baseline start/end, variance, baseline lane, deadline marker | Capture and row overlay exist; richer lane later | Partial |
| Performance | Smart rendering/virtualization | visible row window, visible column/window, stable row heights, overscan | Defer until data scale requires it and proof covers it | Backlog |
| Accessibility | Keyboard/touch/ARIA | row navigation, focus rings, button labels, touch target size, non-color cues | Keyboard and ARIA proof exists; touch/localization later | Partial |
| Data integration | REST sync and events | read model, command write, audit event, optimistic state rules | UOK command bus and audit events, no client-owned persistence | Implemented |
| Data integration | Provider/batch sync modes | backend source, batch transaction, conflict state, local rollback | Selected-task bulk completion uses existing server-validated task writes; richer conflict UX and atomic batch endpoint later | Partial |
| Export/import | Output formats | visible CSV, PDF/image, Excel, project exchange, import validation | CSV exists; document/image/project export later | Partial |
| History | Undo/redo | command stack, reversible payload, server reconciliation, audit correlation | Needs explicit command-stack design | Backlog |

## Near-Term UOK Implementation Order

1. Taskbar hover/focus details: low-risk visible polish from both projects; can be implemented in the current first-party SVG renderer.
2. Dependency drag creation: implemented with taskbar connector handles and the existing Python-validated dependency API.
3. Context row menu: implemented with a reusable workspace context menu primitive and planning task actions.
4. Keyboard hotkeys and focus movement: implemented for Gantt grid row navigation and common task actions.
5. Additional scales: hour, quarter, and year implemented; later minutes, sprints, and stages remain backlog.
6. Fullscreen/focus mode: implemented as a UOK-owned dense workspace overlay with saved-view persistence.
7. Column reorder and pinned WBS/task columns implemented with shared table primitives.
8. Selected dependency-chain highlighting: implemented as a UOK-owned SVG/grid overlay before heavier scheduling features.
9. Timeline panning and controlled wheel zoom: implemented with UOK-owned interaction helpers.
10. Click-drag task creation: implemented with Shift-drag empty timeline range creation and server-validated task writes.
11. Derived timeline markers: implemented first-party marker flags for visible-task due dates, baseline variance, and milestones.
12. Virtualization and larger-data rendering: performance work after feature behavior stabilizes and real schedule scale requires it.

## Validation

Feature slices from this intake must pass the relevant local checks:

```powershell
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
