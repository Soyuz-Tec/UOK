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
| Configurable scales from hour to year | Backlog | Add hour, quarter, and year modes without changing the renderer boundary. |
| Timeline cell templates and task templates | Partial | Use UOK-owned render helpers and status indicators; avoid third-party template API cloning. |
| Tooltips and quick info | Implemented | UOK renders accessible first-party taskbar hover/focus detail. |
| Keyboard navigation | Partial | Extend focus movement and hotkeys in the grid/timeline. |
| Fullscreen mode | Backlog | Add workspace/fullscreen toggle if it improves dense planning work. |
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
| Configurable scales including hours/minutes/sprints/stages | Backlog | Add scale modes as UOK planning-specific options. |
| Customizable grid columns | Implemented | Field presets, visibility, resize, and autofit exist. |
| Grid sorting and task filtering | Partial | Search/filter implemented; richer column sorting remains. |
| Toolbar and context menu | Partial | Toolbar exists; context row menu remains backlog. |
| Taskbar tooltips | Implemented | UOK-owned hover/focus task detail is rendered in the SVG timeline. |
| Zooming with scroll | Backlog | Add controlled wheel/trackpad zoom without breaking page scroll. |
| Hotkeys | Backlog | Add discoverable keyboard actions for common planning operations. |
| Virtualization for large data sets | Backlog | Add only with measurable performance need and tests. |
| Localization | Backlog | Requires UOK-wide localization approach, not planning-only strings. |
| Light/dark themes | Implemented | UOK appearance tokens and UI proof cover light/dark behavior. |
| Work-time calendars and resource calendars | Partial | Calendar-aware scheduling exists partially; resource calendars remain backlog. |
| Critical path, slack, baselines | Partial | CPM read model exists; richer UX and baseline lanes remain. |
| Resource planning and workload | Partial | Resource assignment and warnings exist; workload visualization can mature. |
| Task grouping, rollups, split tasks, unscheduled tasks | Backlog | Add only after core dependency/constraint model is stronger. |
| Undo/redo | Backlog | Needs command stack with server reconciliation. |
| Export/import | Partial | CSV exists; PDF/image/Excel/MS Project equivalents remain later. |

## Near-Term UOK Implementation Order

1. Taskbar hover/focus details: low-risk visible polish from both projects; can be implemented in the current first-party SVG renderer.
2. Dependency drag creation: implemented with taskbar connector handles and the existing Python-validated dependency API.
3. Context row menu: professional grid workflow; should reuse shared pop-up/menu primitives if promoted.
4. Keyboard hotkeys and focus movement: improves accessibility and dense-workflow speed.
5. Additional scales: hour, quarter, year, and later sprints/stages.
6. Column reorder and pinned columns: continue grid maturity using shared table primitives.
7. Virtualization and timeline panning: performance work after feature behavior stabilizes.

## Validation

Feature slices from this intake must pass the relevant local checks:

```powershell
npm --prefix web run build
npm --prefix web test
npm --prefix web run test:ui-proof
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```
