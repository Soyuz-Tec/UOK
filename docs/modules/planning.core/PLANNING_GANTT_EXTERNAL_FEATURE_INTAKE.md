# Planning Gantt External Feature Intake

**Status:** Active implementation input.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact records Gantt feature and interaction ideas identified from DHTMLX Gantt and SVAR React Gantt. It is a feature-intake document for UOK-owned `planning.core` work.

This artifact does not permit copying third-party source code, vendoring third-party Gantt renderers, or adding a Gantt dependency. UOK may use these projects only to understand feature vocabulary, common user expectations, and prioritization.

This artifact records intake disposition, not implementation or release maturity. The authoritative evidence maturity for Planning Gantt capabilities is maintained only in `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md` and `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md`. A disposition here must not be interpreted as `runtime_proven`, `production_ready`, or any other evidence-state claim.

## Sources Reviewed

| Source | Reviewed for | Notes |
|---|---|---|
| `https://github.com/DHTMLX/gantt` | Community feature set, plugin vocabulary, sample gallery, data API ideas, advanced PRO comparison | Snapshot `e5ea07b` verified on 2026-07-09. DHTMLX describes configurable task grids, projects, milestones, four dependency types with lag, drag scheduling, progress bars, templates, plugins, data loading/saving, export, accessibility, touch support, events, TypeScript definitions, and many sample-level feature variants. |
| `https://github.com/svar-widgets/react-gantt` | React-first feature vocabulary, public type surface, demo gallery, large-data concerns, toolbar/context menu ideas, PRO comparison | Snapshot `8ce2cde` verified on 2026-07-09. SVAR describes React/TypeScript support, task and dependency visualization, editable tasks, hierarchy, custom scales, grid sorting/filtering, toolbar/context menu, tooltips, scroll zoom, hotkeys, virtualization, localization, themes, and PRO scheduling features. |

## Intake Rules

- Build only UOK-owned React, TypeScript, SVG, HTML, CSS, and Python scheduling code.
- Keep scheduling authority in Python.
- Keep reusable frontend behavior under `web/src/shared` when it can apply beyond planning.
- Keep export artifact primitives global under `web/src/shared/exporting`; planning owns only Gantt-specific payloads.
- Do not copy third-party implementation, CSS, type names as APIs, examples, or branded UI.
- Do not add `dhtmlx-gantt`, `@svar-ui/react-gantt`, or related packages without a new ADR.
- Read disposition as an intake decision: `Adopted/current` means the idea is represented in the current UOK-owned capability shape, `Adopted/partial` means only a bounded subset is adopted, `Deferred` means it is outside the current scope, and `Global boundary` means another UOK capability owns it.
- Use `docs/modules/planning.core/PLANNING_GANTT_FEATURE_CATALOG.md` and `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md` for implementation evidence, validation maturity, and release readiness.

## DHTMLX Feature Vocabulary

| Feature idea | Disposition | UOK direction |
|---|---:|---|
| Configurable task grid with tree/task column | Adopted/current | First-party grid supports pinned WBS/task columns plus inline edits for core mutable task fields. |
| Projects/summary tasks and milestones | Adopted/current | Keep summary and milestone rendering first-party. |
| Four dependency types plus lag | Adopted/current | Keep validation in Python and UI editing in inspector. |
| Drag scheduling and resize | Adopted/current | Continue server-validated move/resize/progress behavior. |
| Drag-to-create dependency links | Adopted/current | Taskbar connector handles create finish-to-start links through server validation. |
| Progress bar editing | Adopted/current | Keep progress drag handle and inspector edits. |
| Lightbox/task editor | Adopted/partial | UOK equivalent is the inspector plus inline grid edits for title, dates, status, and progress; richer compact edit flows remain later. |
| Configurable scales from minute to year | Adopted/current | UOK-owned minute, hour, day, week, sprint, stage, month, quarter, and year visual modes exist without changing the renderer boundary or Python scheduling authority. |
| Timeline cell templates and task templates | Adopted/partial | Use UOK-owned render helpers and status indicators; avoid third-party template API cloning. |
| Tooltips and quick info | Adopted/current | UOK renders accessible first-party taskbar hover/focus detail. |
| Keyboard navigation | Adopted/current | Grid rows support arrow/home/end focus movement plus common task hotkeys. |
| Fullscreen mode | Adopted/current | UOK-owned focus mode expands the planning workspace without invoking third-party fullscreen code. |
| Drag timeline / click-drag new task | Adopted/current | Timeline panning, Ctrl/Command wheel zoom, and Shift-drag empty-space task creation use UOK-owned interactions. |
| Smart rendering / large data performance | Adopted/current | ADR-0016 records the measured 500-row breach; shared grid/timeline row windowing activates only above 200 visible tasks. |
| Data loading/saving and REST sync | Adopted/current | UOK uses FastAPI read models and command writes, not direct client-owned persistence. |
| Export to document/image/project formats | Global boundary | PDF, PNG, HTML/office documents, Excel, iCal, MS Project, CSV, and import/export orchestration are separate global UOK artifact capabilities; Planning should consume that boundary without redeploying it. |
| Locales/accessibility/touch | Adopted/current | Shared UOK English/Arabic localization, RTL, virtual keyboard focus, 44px touch targets, and narrow/reflow behavior are part of the current UOK-owned direction. |
| Event system | Adopted/partial | UOK equivalent is command bus plus planning audit events. |
| Row resize | Adopted/current | UOK row-height model supports per-project row overrides, drag/keyboard resize handles, and double-click/Enter row fit without third-party code. |
| Drag rows / branch ordering | Deferred | Add WBS reorder only after hierarchy command validation is explicit. |
| Right-side grid columns / no-grid mode / bottom scale / RTL | Adopted/partial | Timeline-only and RTL logical layout are current; right-side grid and bottom scale remain deferred variants. |
| Backward planning and fixed project dates | Adopted/partial | Task constraints cover must-start, must-finish, and start/finish no-earlier/no-later rules; backward scheduling direction and fixed project limits remain deferred. |
| Empty-state screen | Adopted/current | First-party grid and timeline empty state appears when filters or a project leave no visible tasks. |
| Deadline/event markers | Adopted/partial | Project start/end markers plus derived visible-task due, variance, and milestone markers are current; arbitrary user event markers remain deferred. |
| Import from Excel/MS Project/Primavera/iCal | Deferred | Requires a validated server import pipeline and no external service dependency. |

## SVAR Feature Vocabulary

| Feature idea | Disposition | UOK direction |
|---|---:|---|
| React and TypeScript native component model | Adopted/current | UOK renderer is first-party React and TypeScript. |
| Task and dependency visualization | Adopted/current | Continue UOK-owned SVG timeline and dependency-path improvements. |
| Interactive drag-and-drop editing | Adopted/current | Keep all edits server-validated. |
| Customizable task edit form | Adopted/partial | UOK inspector supports task edit; denser compact flows remain deferred. |
| Hierarchical subtasks | Adopted/current | Summary hierarchy and collapse/expand are part of the current shape. |
| Configurable scales including hours/minutes/sprints/stages | Adopted/current | UOK-owned minute, hour, day, week, sprint, stage, month, quarter, and year visual scale controls exist while task scheduling remains date-based. |
| Customizable grid columns | Adopted/current | Field presets, visibility, resize, and autofit are part of the current shape. |
| Grid sorting and task filtering | Adopted/current | Search/filter plus visible-column sorting use current UOK-owned field presets. |
| Toolbar and context menu | Adopted/current | Toolbar and task row context menu use server-routed Planning actions. |
| Taskbar tooltips | Adopted/current | UOK-owned hover/focus task detail is rendered in the SVG timeline. |
| Zooming with scroll | Adopted/current | Ctrl/Command wheel uses the existing UOK scale model while ordinary scrolling remains native. |
| Hotkeys | Adopted/current | Common task actions can be triggered from focused Gantt rows. |
| Virtualization for large data sets | Adopted/current | Measurement-triggered, dependency-free row windowing activates above 200 visible tasks after the measured 500-row breach; smaller schedules keep the full-row path. |
| Localization | Adopted/current | UOK-wide provider/policy owns locale, direction, fallback, and Intl formatting. |
| Light/dark themes | Adopted/current | UOK appearance tokens own light/dark behavior. |
| Work-time calendars and resource calendars | Adopted/current | Project calendars plus resource-scoped capacity calendars, effective periods, weekdays, holidays, capacity exceptions, and calendar-aware leveling are current UOK-owned capabilities; `calendar.core` free/busy remains advisory and does not move tasks automatically. |
| Critical path, slack, baselines | Adopted/current | CPM read model, critical-path explanation, slack counts, per-row baseline lanes, and variance badges are part of the current shape. |
| Resource planning and workload | Adopted/current | Resource assignment, warnings, first-party daily workload lanes, and explicit resource leveling are current directions. |
| Task grouping, rollups, split tasks, unscheduled tasks | Deferred | Add only after the core dependency/constraint model is stronger. |
| Undo/redo | Adopted/current | Safe task, dependency, calendar, and resource-assignment inverses use the project-scoped atomic endpoint. Create/delete-task and resource-leveling history remain unsupported, fail closed, and are non-reversible under the current registry. |
| Export/import | Global boundary | PDF, PNG, HTML/office documents, Excel, iCal, MS Project, CSV, and import/export orchestration are handled by the separate global artifact capability; Planning owns only schedule-specific payload mapping. |
| Header menu for visible columns | Adopted/current | A first-party per-column header menu covers sort, quick action, width reset, hide, and show-all controls. |
| No-grid and read-only/prevent-actions modes | Adopted/current | Timeline-only mode and server-derived actor capabilities are current. Operations receives all current capabilities, trader receives read/edit, and finance/viewer remain review-only across read, edit, baseline-create, level, link, gate-approve, analyze, analysis-approve, and admin authority. The frontend defaults to review-only until that matrix loads, and a local review toggle cannot grant authority. |
| Custom task templates and cell borders | Adopted/partial | UOK owns task/status templates and timeline grid borders through CSS tokens. |
| Scroll to date / custom zoom / min scale unit | Adopted/partial | Scroll-to-today, scroll-to-selected-task, arbitrary date navigation, project-fit navigation, and scale controls are current; custom zoom bounds remain deferred. |
| Editor validation, readonly editor, comments, custom controls | Adopted/partial | Inspector validation is current; comments and additional editor modes remain deferred. |
| Start/end date display variants and duration units | Adopted/partial | Current schedule is date-based; hour/minute duration editing remains deferred. |

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
| Data sync/events | JSON loading, REST sync, event hooks, lifecycle callbacks, batch updates | command type, command id, actor, audit event, rollback state, read-model version, validation warnings | Bulk completion, status/progress, and date-shift commands, status panel, audit/event log later, command result messages |
| Performance | Smart rendering, virtualization, lazy loading, dynamic loading, large data mode | visible row window, visible time window, overscan, row height, total counts, loading boundary | Virtualized rows, loading placeholder, stable scrollbars, large-schedule proof |
| Accessibility/localization | WAI-ARIA, keyboard navigation, hotkeys, touch support, 32/localized labels, RTL | aria labels, focus target, keyboard command map, locale id, text direction, date/number format | Shared locale/direction/formatting, translated reference labels, virtual focus, touch target, reflow, and RTL proof |
| Export/import | PDF, PNG, HTML/office documents, Excel, iCal, MS Project, CSV, import validation | export format, visible fields, date range, import row mapping, validation summary | Export menu, import wizard later, downloaded artifact status |
| Advanced scheduling | Auto-schedule, critical path, slack, calendars, constraints, resource planning, workload, backward planning, undo/redo | dependency graph, calendar, resource capacity, slack, constraint type/date, scheduling direction, undo command stack | Critical overlays, workload lane, constraint indicators, undo/redo toolbar buttons |

| Capability family | Feature/function | Typical properties/elements to model | UOK direction | Disposition |
|---|---|---|---|---:|
| Workspace shell | Fullscreen/focus workspace | toolbar toggle, pressed state, viewport overlay, exit action, preserved scrollable toolbar | Local `planning.core` focus mode with saved-view persistence | Adopted/current |
| Workspace shell | Multiple chart instances | isolated project id, selected view state, independent scroll/zoom state | Keep each Planning route instance isolated by project and local-storage keys | Adopted/partial |
| Workspace shell | View switching | Gantt, board, list, calendar, workload, people, dashboard | Existing read-model tabs from one validated schedule | Adopted/current |
| Grid | Configurable columns | id, label, width, min/max width, visibility, preset, resize/autofit, order, pin flags | Shared table sizing/visibility/order primitives plus Planning-specific pinned columns | Adopted/partial |
| Grid | Header menu | column id, checked state, hide/show action, reset widths, sort action, keyboard access | First-party per-column menu complements field controls and shared column primitives | Adopted/current |
| Grid | Add-task/action column | command button, row action menu, add child/add below, disabled/read-only states | Row menu is current; a dedicated add-column control remains deferred if density permits | Adopted/partial |
| Grid | Tree column | WBS code, indentation, summary marker, expand/collapse state, parent id | Summary rows, WBS sorting, and accessible per-summary expand/collapse controls with nested descendant hiding | Adopted/current |
| Grid | Inline cell editing | editable field, validation state, commit/cancel, keyboard handling, server command | Title, start, end, progress, and status cells use shared inline editing and server task validation | Adopted/current |
| Grid | Column sorting/filtering | column id, direction, filter mode, query, status/resource criteria | Search/filter and visible-column sorting use UOK-owned read-model helpers | Adopted/current |
| Grid | Branch ordering / row drag | dragged task id, drop parent, before/after mode, valid WBS target, audit event | A WBS reorder command requires explicit Python validation before adoption | Deferred |
| Grid | Row resize | row id, height, min/max, global density fallback, persisted override | First-party row-height helper, row-bottom separators, and keyboard resize | Adopted/current |
| Timeline | Time scales | scale id, unit, step, label, group label, cell width, zoom order | Minute/hour/day/week/sprint/stage/month/quarter/year scale model | Adopted/current |
| Timeline | Timeline templates | header label, cell class, task shape class, weekend/holiday class | UOK-owned render helpers and CSS tokens | Adopted/partial |
| Timeline | Markers | today, project bounds, milestones, deadlines, vertical event markers | Today, project boundary markers, and derived visible-task due/variance/milestone markers are current; arbitrary user event markers remain deferred | Adopted/partial |
| Timeline | Drag timeline and scroll zoom | pointer panning, wheel modifier, scale bounds, scroll preservation | Empty-space panning, Ctrl/Command wheel scale stepping, and Shift-drag task creation use UOK-owned interaction helpers | Adopted/current |
| Timeline | Zoom-to-fit and scroll-to-date | project range, selected date, today, viewport width, scale bounds | Today, selected task, arbitrary date target, and project-fit commands are current; custom zoom bounds remain deferred | Adopted/partial |
| Timeline | Layout modes | grid left/right/hidden, scale top/bottom, RTL, fixed size/autosize | Timeline-only and RTL logical workspace with LTR-isolated chronology are current; right grid and bottom scale remain deferred | Adopted/partial |
| Tasks | Task types | task, summary/project, milestone, unscheduled, split segment, rollup | Task/summary/milestone are current; unscheduled/split/rollup remain deferred | Adopted/partial |
| Tasks | Taskbar editing | move, resize start/end, progress drag, dependency handles | Use first-party SVG with server validation | Adopted/current |
| Tasks | Task status presentation | status code, color token, non-color label, critical flag, selected/focus state | Use semantic status for bars and grid rows | Adopted/current |
| Tasks | Quick info/tooltips | title, WBS, status, progress, start/end, assignee, dependency hints | First-party hover/focus task detail | Adopted/current |
| Tasks | Read-only/prevent-actions mode | permission flag, disabled drag handles, disabled context actions, review-only labels | Server-derived capability matrix gates controls and the UI fails closed to review-only until authority loads; local review mode can only reduce access | Adopted/current |
| Tasks | Deadline and outside-timescale handling | deadline date, warning marker, clipped label, offscreen indicator | Derived visible-task marker flags are current; a clipped/offscreen indicator model remains deferred | Adopted/partial |
| Editing | Lightbox/edit form | modal or side panel, title, dates, progress, parent, type, status, resources | UOK inspector path is current; compact edit improvements remain deferred | Adopted/partial |
| Editing | Comments and custom controls | task comment thread, custom fields, validation messages, read-only fields | Design after module comments/custom fields have an owned contract | Deferred |
| Dependencies | Link model | predecessor, successor, type, lag/lead, validation errors, cycle checks | Python-owned validation with inspector and drag-link UI | Adopted/current |
| Dependencies | Chain highlighting | predecessor/successor path, selected task emphasis, critical chain | Selected predecessor/successor rows, task bars, and dependency paths highlight in the first-party renderer | Adopted/current |
| Scheduling | Auto scheduling | dependency propagation, calendar rules, manual/auto mode, constraints | Python dependency propagation, project calendar rules, cascade scheduling, task constraints, and per-task auto/manual scheduling | Adopted/current |
| Scheduling | CPM and slack | early/late dates, total slack, critical flag, variance | CPM read model and Dashboard critical-path/slack explanation | Adopted/current |
| Scheduling | Calendars | working days, holidays, resource calendars, ignored/non-linear periods | Project calendars plus resource-scoped capacity calendars and exceptions drive scheduling/capacity behavior; `calendar.core` free/busy remains advisory context | Adopted/current |
| Scheduling | Backward planning and fixed project limits | direction, project start/end bounds, constraint violation messages | Task-level constraint violations are current; backward direction and fixed project limits remain deferred | Adopted/partial |
| Resources | Assignments | resource id/name, role, allocation, capacity, warnings, workload lane | Assignments, warnings, and workload lanes derive from the validated schedule read model | Adopted/current |
| Resources | Resource panel/load chart | resource row, load cell, chart mode, allocation template, overload state | First-party Workload view renders resource lanes, daily allocation cells, peak load, and overload status | Adopted/current |
| Baselines | Baseline overlays | baseline start/end, variance, baseline lane, deadline marker | Capture, per-row timeline lanes, and variance badges | Adopted/current |
| Performance | Smart rendering/virtualization | visible row window, visible column/window, stable row heights, overscan | Shared variable-height row window, synchronized scroll, 480px overscan, ARIA counts/indexes, and full-row fallback at 200 or fewer visible tasks | Adopted/current |
| Accessibility | Keyboard/touch/ARIA | row navigation, focus rings, button labels, touch target size, non-color cues | Keyboard virtual-boundary focus, non-drag paths, ARIA counts/indexes, 44px touch actions, RTL, and reflow | Adopted/current |
| Data integration | REST sync and events | read model, command write, audit event, optimistic state rules | UOK command bus and audit events; no client-owned persistence | Adopted/current |
| Data integration | Provider/batch sync modes | backend source, batch transaction, conflict state, local rollback | The project-scoped atomic endpoint accepts 1–500 ordered operations across the current ten-kind registry under one lock, idempotency key, strong ETag, final validation, revision, and transaction. Typed conflict and stale-write recovery preserve server state; any failed operation rolls back the whole batch. | Adopted/current |
| Export/import | Output formats | visible CSV, PDF/image, HTML/office documents, Excel, project exchange, import validation | A separate global artifact/import-export capability owns formats; Planning consumes it without redeploying it | Global boundary |
| History | Undo/redo | command stack, reversible payload, server reconciliation, audit correlation | Safe task, dependency, calendar, and resource-assignment inverses use the atomic endpoint with source-command correlation. Create/delete-task and resource-leveling history remain unsupported, fail closed, and are non-reversible under the current registry. | Adopted/current |

## Intake Sequencing Notes

These notes retain the source-research sequence; they are not an implementation-status list. Consult the catalog and traceability registry for current evidence maturity.

1. Taskbar hover/focus details: adopted through the first-party SVG renderer.
2. Dependency drag creation: adopted with taskbar connector handles and the Python-validated dependency API.
3. Context row menu: adopted with a reusable workspace context menu primitive and Planning task actions.
4. Keyboard hotkeys and focus movement: adopted for Gantt grid row navigation and common task actions.
5. Additional scales: adopted for minute, hour, sprint, stage, quarter, and year visual scales; time-of-day task duration editing remains deferred.
6. Fullscreen/focus mode: adopted as a UOK-owned dense workspace overlay with saved-view persistence.
7. Column reorder and pinned WBS/task columns: adopted with shared table primitives.
8. Selected dependency-chain highlighting: adopted as a UOK-owned SVG/grid overlay.
9. Timeline panning and controlled wheel zoom: adopted with UOK-owned interaction helpers.
10. Click-drag task creation: adopted with Shift-drag empty timeline range creation and server-validated task writes.
11. Derived timeline markers: adopted for visible-task due dates, baseline variance, and milestones.
12. Virtualization and larger-data rendering: adopted after a measured 500-row breach justified shared row windowing above 200 visible tasks; this intake statement is not an evidence-maturity claim.

## Validation

Feature slices from this intake must pass the relevant local checks:

```powershell
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
