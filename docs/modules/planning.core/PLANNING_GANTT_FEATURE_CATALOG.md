# Planning Gantt Feature Catalog

**Status:** Active implementation catalog; Gate A evidence reclassification in progress.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact catalogs the Gantt chart features UOK has identified from common professional Gantt applications and open-source Gantt libraries. It is a build map for `planning.core`; it is not permission to copy third-party source code or add third-party Gantt renderers.

UOK must implement these features as first-party React, TypeScript, SVG, HTML, CSS, and Python scheduling code. External tools may inform feature vocabulary and user expectations only.

Gate A stabilization is governed by `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`. An `Implemented` label in this catalog records source or product-surface presence; verification maturity is authoritative only in `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md` and must not be inferred as `production_ready`.

External feature intake from DHTMLX Gantt and SVAR React Gantt is tracked in `docs/modules/planning.core/PLANNING_GANTT_EXTERNAL_FEATURE_INTAKE.md`.

## Implementation Rules

- Scheduling authority stays in Python.
- React renders validated schedule read models and sends proposed changes back to Python.
- Shared UI and export behavior belongs in `web/src/shared` when it can serve other modules.
- Export artifact primitives are global UOK features; planning owns only schedule-specific payloads.
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
| Baselines | Implemented | New captures are immutable, complete v2 canonical snapshots with SHA-256 verification, source revision/creator/correlation metadata, and exact compare reads. Legacy snapshots are labeled partial in API/UI. Variance fields, per-row timeline lanes, and non-color badges render on task rows. |
| Critical path | Implemented | Critical flags, highlighting, zero-slack counts, and a Dashboard critical-path explanation panel exist. |
| Calendars | Implemented | Project working days, holidays, and ignored periods drive scheduling, propagation, read models, and timeline shading. Resource calendars remain a separate resource-planning backlog item. |
| Resources | Implemented | Resource creation, assignment, allocation display, daily workload lanes, and over-allocation warnings exist. |
| Export/import | External global boundary | PDF, PNG, HTML/office documents, Excel, iCal, MS Project, CSV, and import/export orchestration are deployed separately as global UOK artifact capabilities; planning consumes that boundary and owns only schedule-specific payloads/read-model mapping. |
| UI proof | Implemented | Playwright proof covers rendering, controls, inspector tabs, responsiveness, and console cleanliness. |
| Server capabilities | Implemented | Actor-specific read/edit/baseline/level/link/gate/admin capabilities are enforced by command permission, embedded in schedule reads, and mirrored by fail-closed UI controls. Local review mode cannot grant authority. |
| Database invariants | Implemented | PostgreSQL and SQLAlchemy enforce schedule date/type/progress/lag/allocation/scheduling-mode and uniqueness rules; hierarchy, dependency direction, and assignment lookups have organization-first indexes. |
| Audit correlation | Implemented | Successful command responses, module events, and Planning schedule events carry the same authoritative command-log correlation ID, including derived changes and atomic batches. |

## Grid And Column Features

| Feature | Target behavior | Status |
|---|---|---:|
| Resizable columns | Drag column separator to adjust width; keyboard arrows resize; widths persist locally. | Implemented |
| Auto-fit columns | Double-click column resize handle/header to fit visible content. | Implemented |
| Shared column resize primitive | Contacts and Planning use shared resize handle/sizing hook instead of local copies. | Implemented |
| Field presets | Core, Progress, and Resources column sets. | Implemented |
| Column visibility | User-selectable individual columns beyond presets. | Implemented |
| Column header menu | Per-column menu supports sorting, quick action, width reset, hiding non-pinned columns, and restoring visible columns. | Implemented |
| Column reorder | Drag headers to reorder columns; order persists locally per field preset. | Implemented |
| Pinned columns | Keep WBS/task pinned ahead of reordered fields and sticky inside the grid. | Implemented |
| Sort by columns | Sort visible rows by WBS, task, dates, duration, progress, critical flag, assignee, and status. | Implemented |
| Inline grid edit | Edit task title, start, end, progress, and status cells directly in the grid with server validation; derived/read-only cells stay locked. | Implemented |
| Tree summary expander | WBS tree cells expose accessible per-summary expand/collapse controls; nested descendants hide with their collapsed parent. | Implemented |
| Context row menu | Add below, add child, duplicate, delete, convert to milestone, and status actions. | Implemented |

## Row And Density Features

| Feature | Target behavior | Status |
|---|---|---:|
| Compact/standard/roomy density | Toolbar-controlled row height modes. | Implemented |
| Double-click task header to shorten rows | Double-click Task header toggles compact/standard density. | Implemented |
| Double-click summary row | Double-click summary row toggles that summary branch while toolbar commands expand/collapse all branches. | Implemented |
| Per-row height | Resize individual rows from a row-bottom separator; keyboard arrows adjust height and per-project overrides persist locally. | Implemented |
| Auto-height row fit | Double-click or press Enter on a row resize separator to fit that row to its content without breaking grid/timeline alignment. | Implemented |
| Scroll synchronization | Grid and timeline row alignment must remain stable. | Implemented |
| Empty visible schedule state | Grid and timeline render a first-party empty state when filters or a project leave no visible tasks. | Implemented |

## Timeline Features

| Feature | Target behavior | Status |
|---|---|---:|
| Hour/day/week/month/quarter/year scale | Toolbar scale controls and zoom slider. Hour view uses 6-hour visual buckets while server scheduling remains date-based. | Implemented |
| Today marker | Current date marker and scroll-to-today command. | Implemented |
| Fit project | Fit button switches to a project-range scale and aligns the timeline viewport to the validated project start/end range. | Implemented |
| Scroll to selected task | Toolbar command centers the selected task's date on the timeline and returns focus to the selected row. | Implemented |
| Scroll to date | Date input and Go command center an arbitrary date on the current timeline scale. | Implemented |
| Project boundary markers | Timeline renders labeled start/end markers from the validated project read model. | Implemented |
| Task deadline/event markers | Timeline renders first-party visible-task marker flags for critical due dates, baseline variance, and milestones. | Implemented |
| Drag timeline and controlled wheel zoom | Drag empty timeline/header space to pan; Ctrl/Command wheel steps the existing zoom scale without breaking normal scroll. | Implemented |
| Click-drag task creation | Hold Shift and drag empty timeline space to draw a date range, then submit a server-validated task proposal. | Implemented |
| Timeline-only layout | Toolbar toggle hides the grid and gives the timeline the full Gantt workspace width; split view restores the grid. | Implemented |
| Weekend shading | Non-working weekend visual bands. | Implemented |
| Holiday shading | Calendar holiday visual bands. | Implemented |
| Minute/sprint/stage scales | Additional specialized visual scale modes. Minute view uses 30-minute visual buckets; sprint and stage use 14-day and 30-day planning buckets while server scheduling remains date-based. | Implemented |
| Timeline header grouping | Month/year/week grouping. | Implemented |
| Ignored periods | Project calendar ignored ranges are persisted, returned in the read model, expanded into non-working dates, and shaded in the timeline. | Implemented |

## Task Shape And Color Features

| Feature | Target behavior | Status |
|---|---|---:|
| Normal task bars | Render start/end duration bars. | Implemented |
| Summary bars | Render phase/summary bars distinctly. | Implemented |
| Milestone diamonds | Render zero-duration milestones. | Implemented |
| Progress overlay | Inner progress fill shows completion percentage. | Implemented |
| Status color coding | Not started, in progress, complete, overdue, blocked, critical. | Implemented |
| Non-color indicators | Labels/icons/patterns so status does not depend on color alone. | Implemented |
| Selected/hover/focus states | Visible selected and keyboard focus states. | Implemented |
| Keyboard navigation and hotkeys | Move row focus with arrow/home/end keys and run common task actions by shortcut. | Implemented |
| Taskbar tooltips | Hover/focus task detail with status, dates, and progress. | Implemented |
| Resize start/end handles | Drag bar edges to change duration. | Implemented |
| Progress drag handle | Drag progress handle to update percent through server validation. | Implemented |

## Dependency Features

| Feature | Target behavior | Status |
|---|---|---:|
| Dependency display | Draw connector paths between visible predecessor/successor tasks. | Implemented |
| Dependency inspector | Create/update/remove dependency records. | Implemented |
| Dependency lag/lead | Positive lag and negative lead. | Implemented |
| Dependency validation | Reject missing refs, self-links, cycles, and invalid date order. | Implemented |
| Dependency drag creation | Drag from one task to another to link tasks through server validation. | Implemented |
| Highlight chain | Show selected task predecessors and successors in grid rows, task bars, and dependency paths. | Implemented |
| Cascade scheduling toggle | Move successors when predecessor dates change, or reject violating predecessor moves when disabled. | Implemented |

## Scheduling And Python Features

| Feature | Target behavior | Status |
|---|---|---:|
| Server-side validation | Python validates all schedule mutations before UI accepts them; a separate result validator recomputes CPM hard invariants. | `integration_tested` |
| Topological ordering | Use deterministic dependency graph ordering for propagation, CPM, and cycle checks without UI row-order input. | `unit_tested` |
| CPM read model | Logic-driven early/late dates, total/free float, target variance, engine version, independent validation, and critical flags. | `integration_tested` |
| Calendar-aware propagation | Respect working days and holidays. | Implemented |
| Resource over-allocation | Warn when allocation exceeds capacity. | Implemented |
| Resource leveling | Explicit Level command moves later auto-scheduled assigned tasks forward to resolve daily resource over-allocation where capacity allows, then reruns server validation and audit events. | Implemented |
| Constraints | Must-start, must-finish, start/finish no-earlier-than, and start/finish no-later-than constraints are stored per task, enforced by Python scheduling, returned in read models, editable in the inspector, and exported. | Implemented |
| Manual/auto scheduling | Per-task auto/manual scheduling mode is stored with each task; auto tasks participate in dependency propagation, while manual tasks keep their dates and surface validation conflicts. | Implemented |
| Optimistic concurrency | Project revisions and task versions are persisted; actor-visible schedules return canonical strong ETags; existing-project writes require exact `If-Match` and expose typed 428/412 reload/reapply recovery. | `runtime_proven` |

## Workspace And Professional Features

| Feature | Target behavior | Status |
|---|---|---:|
| Board/List/Calendar/Workload/People/Dashboard views | Alternate read-model views from the same validated schedule; Workload includes daily resource load lanes and overload counts. | Implemented |
| Fullscreen/focus mode | Expand the planning workspace into a dense viewport overlay with an explicit exit action. | Implemented |
| Layout mode persistence | Saved views include split/timeline-only layout mode with other Gantt workspace preferences. | Implemented |
| Review/edit mode | Toolbar toggle prevents schedule mutations by disabling task creation, edit commands, row action menus, drag handles, progress handles, dependency handles, and inspector editor controls. | Implemented |
| Bulk selection | Select visible rows and submit completion, status/progress, or date-shift intents through one atomic task-update batch. | `runtime_proven` |
| Bulk edit | Project-scoped task updates commit one revision or roll back every operation; owner, priority, and calendar fields remain later work. | `runtime_proven` |
| Undo/redo | Single-step inverse commands remain revision-aware; bounded multi-task update restores use the atomic endpoint, while destructive or unsupported history kinds fail closed. | Partial |
| Saved views | Store filters, density, fields, scale, and grouping. | Implemented |
| Search/filter/group | Search task titles; filter by status, critical, resource, milestone. | Implemented |
| Export/import | Planning uses the separately deployed global artifact boundary for PDF, PNG, HTML/office documents, Excel, iCal, MS Project, and CSV needs; no planning-specific redeployment is required. | External global boundary |
| Audit history | Planning schedule events are recorded. | Implemented |

## Current UI Audit And Execution Plan

**Status:** Active alpha.3 polish target.

The live Gantt workspace audit on `http://127.0.0.1:18088/` found these usability issues:

| Issue | Runtime evidence | Execution decision |
|---|---|---|
| Timeline utility toolbar hides too many controls behind horizontal scrolling | The utility region was about `640px` wide while its controls measured about `3781px`; roughly 25 of 60 toolbar controls were initially outside the viewport. | Split utilities into named workflow groups and allow them to wrap as a full-width command surface instead of one horizontally scrolling strip. |
| Controls were grouped by implementation rather than workflow | Saved views, fields, filters, scale, navigation, exports, density, and status toggles shared one long row. | Use grouped command architecture: saved/fields, filters, modes, scale, navigation, exports, and display toggles. |
| Sparse schedules left excessive blank chart height | A two-task plan rendered inside a roughly `720px` Gantt shell. | Use a content-aware Gantt height variable with a practical minimum and maximum while preserving large-schedule scroll behavior. |
| Grid felt tight and had hidden horizontal overflow | Task grid measured smaller than its rendered column content. | Include action/resize affordance width in the grid sizing calculation and keep pinned columns readable. |
| Inspector occupied permanent width even when not needed | The inspector was useful but always consumed the secondary work region on wide screens. | Add Planning-level inspector collapse/show controls using the shared split-view primitive without changing Contacts behavior. |

Acceptance for this polish slice:

- no horizontally hidden primary Gantt toolbar controls at wide desktop widths;
- grouped toolbar controls remain reachable at tablet and narrow widths;
- chart height is proportional for small schedules and scrolls for larger ones;
- grid/timeline alignment remains stable;
- inspector can be hidden and restored;
- Playwright UI proof, frontend tests, build, candidate verification, and local rebuild pass.

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
