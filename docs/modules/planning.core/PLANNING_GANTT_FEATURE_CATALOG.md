# Planning Gantt Feature Catalog

**Status:** Active evidence catalog; Gates A-E are locally runtime-proven, with hosted CI, review, and merge pending.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

This artifact catalogs the Gantt chart features UOK has identified from common professional Gantt applications and open-source Gantt libraries. It is a build map for `planning.core`; it is not permission to copy third-party source code or add third-party Gantt renderers.

UOK must implement these features as first-party React, TypeScript, SVG, HTML, CSS, and Python scheduling code. External tools may inform feature vocabulary and user expectations only.

Gate A stabilization is governed by `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`. Every status uses the ADR evidence taxonomy: `planned`, `source_present`, `unit_tested`, `integration_tested`, `runtime_proven`, or `production_ready`. A row must not be read as more mature than its linked or reproducible evidence, and no local alpha result implies `production_ready`.

External feature intake from DHTMLX Gantt and SVAR React Gantt is tracked in `docs/modules/planning.core/PLANNING_GANTT_EXTERNAL_FEATURE_INTAKE.md`.

## Implementation Rules

- Scheduling authority stays in Python.
- React renders validated schedule read models and sends proposed changes back to Python.
- Shared UI and export behavior belongs in `web/src/shared` when it can serve other modules.
- Export artifact primitives are global UOK features; planning owns only schedule-specific payloads.
- Planning-specific production UI and CSS belong in `modules/planning.core/web/src`; frontend tests belong in `modules/planning.core/tests/web`.
- Use Python standard library primitives first for scheduling internals: `datetime`, `calendar`, `zoneinfo`, `graphlib.TopologicalSorter`, `csv`, and `json`.
- Do not add a Python, JavaScript, or CSS Gantt chart dependency without a new ADR.
- Verify source size after each implementation slice.

## Current Evidence Foundation

| Area | Status | Current UOK behavior |
|---|---:|---|
| First-party renderer | `runtime_proven` | Owned React/SVG/HTML/CSS Gantt renderer behind `PlanningGantt`; Chromium candidate proof exercises the rendered workspace. |
| Project picker and command context | `runtime_proven` | The shared command bar keeps the project selector, status chip, visible/total task counts, and dependency count together without a separate Planning workspace heading. The `Project schedule`/`Portfolio` scope switch remains unchanged. |
| Project lifecycle and finish authority | `runtime_proven` | The rebuilt PostgreSQL candidate proves reasoned archive/restore, readable archive with fail-closed writes, stable exact replay, non-disclosing purge lock ordering, exact Saturday target commitment, persisted CPM-v2 finish, negative float, and generated REST contracts. |
| View tabs | `runtime_proven` | Gantt, Board, List, Calendar, Workload, People, and Dashboard are exercised in Chromium candidate proof. |
| Task creation commands | `runtime_proven` | Task and milestone creation route through inspector/API flow; keyboard-only creation is covered by Chromium candidate proof. |
| Dependencies | `integration_tested` | Create/update/remove uses server validation and dependency lines render in Gantt. |
| Dependency types | `source_present` | Finish-to-start, start-to-start, finish-to-finish, start-to-finish, lag/lead in backend model. |
| Drag-to-reschedule | `runtime_proven` | Bar drag proposes a date shift, calls the server validation path, and is exercised in Chromium candidate proof. |
| Summary tasks and WBS | `source_present` | Summary rows, WBS sorting, hierarchy validation, collapse/expand controls. |
| Milestones | `source_present` | Milestone task type and diamond rendering. |
| Baselines | `runtime_proven` | New captures are immutable, complete v2 canonical snapshots with SHA-256 verification, source revision/creator/correlation metadata, and exact compare reads. Legacy snapshots are labeled partial in API/UI. Variance fields, per-row timeline lanes, and non-color badges render on task rows. |
| Critical path | `runtime_proven` | CPM v2 preserves exact weekend/holiday commitments, uses a separate working late anchor, and keeps negative float visible; the Gantt and Dashboard expose the resulting critical-path information. |
| Calendars | `integration_tested` | Project working days, holidays, and ignored periods drive scheduling, propagation, read models, and timeline shading. Resource-specific capacity calendars are implemented and tracked separately below. |
| Resources | `runtime_proven` | Resource creation, assignment, allocation display, independently validated daily capacity points, overload warnings, and candidate readback exist. |
| Typed resource domain | `runtime_proven` | Controlled human/team/vehicle/equipment/material/budget/time-window/document/location/asset/custom types, compatible capacity units, optional actor-safe canonical references, effective dates, baseline capture, database constraints, generated contracts, typed inspector controls, PostgreSQL readback, and candidate proof pass. |
| Resource capacity calendars | `runtime_proven` | Per-resource weekdays, holidays, 0–300% default capacity, bounded non-overlapping exceptions, effective-period enforcement, engine v2, independent validation, baseline capture, workload thresholds, calendar-aware leveling, PostgreSQL readback, and rebuilt candidate proof pass. |
| Resource-specific `calendar.core` warnings | `runtime_proven` | Actor-visible Party-linked participants/resources filter busy occurrences, attach exact task IDs, exclude unrelated events, hide private Party/event identity, and preserve strong ETag behavior without automatic task movement; rebuilt candidate proof passes. |
| Immutable what-if snapshots | `runtime_proven` | Complete approved schedule plus bounded temporary typed task changes, detached preview evaluation, CPM/capacity validation, canonical SHA-256 integrity, actor-scoped reads, distinct analysis capability, audit correlation, and ORM/PostgreSQL append-only guards pass candidate proof without changing approved tasks. |
| Reproducible schedule risk | `runtime_proven` | Verified snapshot checksum, fixed seed, bounded triangular distributions, explicit correlation groups, engine/version/limits, CPM-per-sample P50/P80/P90/P95, target probability, confidence assumptions, independent validation, canonical integrity, typed UI, and append-only candidate evidence pass. |
| Governed optimization and recommendations | `runtime_proven` | Dependency-reviewed bounded advisory search records objective/engine/version/limits, explicit completed/timeout/infeasible explanations, independently validated ranked impact/effort/side effects/assumptions and preview; separate reasoned approval, exact stale-safe apply, audit, rollback, database transition guards, benchmark, typed UI, and candidate proof pass. |
| Export/import | `integration_tested` | PDF, PNG, HTML/office documents, Excel, iCal, MS Project, CSV, and import/export orchestration are deployed separately as global UOK artifact capabilities; planning consumes that boundary and owns only schedule-specific payloads/read-model mapping. |
| UI proof | `runtime_proven` | Playwright proof covers rendering, controls, inspector tabs, non-drag mutation paths, stale inverse recovery, responsiveness, and console cleanliness. |
| Measured scale and virtualization | `runtime_proven` | Rollback-only SQLite/PostgreSQL profiles enforce 500/800 read, 2,000/3,000 validation, and 100-update batch p95 budgets. A measured 4.07-second 500-row browser breach justified dependency-free windowing above 200 visible tasks; the controlled single-worker Chromium verification run records 1.179-second interaction, 34 aligned grid/timeline rows, no post-idle long task, and ARIA row metadata. |
| Shared localization, RTL, touch, and reflow | `runtime_proven` | UOK-owned English/Arabic provider, English fallback, Intl formatting, persisted document language/direction, translated shell/Planning labels, logical RTL grid/pinned layout, LTR chronology isolate, coarse-pointer 44px row action, virtual keyboard focus, zero unnamed buttons, 320px/200%-text reflow, screenshot, reload, and console-clean Chromium proof pass without a Planning-local framework. |
| Portfolio and multi-project view | `runtime_proven` | Actor-scoped two-to-six-query aggregate returns metrics, explainable health, status/search paging, diagnostics, and Server-Timing; typed responsive/RTL-safe UI renders a common timeline and schedule drill-in with API, component, Chromium, and candidate proof. |
| Production-like release readiness | `runtime_proven` | One standard operation combines candidate contracts, PostgreSQL scale budgets, persistent CPM and concurrency recovery, live Chromium accessibility/compatibility/console checks, and engineering evidence while preserving the separate `production_ready` boundary. |
| Server capabilities | `runtime_proven` | Actor-specific read/edit/baseline/level/link/gate/analyze/analysis-approve/admin capabilities are enforced by command permission, embedded in schedule reads, mirrored by fail-closed UI controls, and probed through role-matrix plus direct analysis denial tests. Local review mode cannot grant authority. |
| Database invariants | `runtime_proven` | PostgreSQL and SQLAlchemy enforce schedule date/type/progress/lag/allocation/scheduling-mode and uniqueness rules; candidate probes reject invalid direct rows and read back organization-first indexes. |
| Audit correlation | `runtime_proven` | Candidate PostgreSQL proof joins successful command responses, module events, and Planning schedule events by the same authoritative correlation ID, including derived changes and atomic batches. |
| Immutable revision ledger and outbox | `runtime_proven` | Every successful guarded command writes one checksummed revision row and one internal schema-v1 outbox envelope in the schedule transaction; failure/replay, exact inverse-source lookup, payload-poisoning resistance, immutability, sanitized history reads, PostgreSQL concurrency, direct guard probes, and rebuilt candidate verification pass. External dispatch and delivery state are intentionally absent. |
| Structured errors | `runtime_proven` | Validation, permission, idempotency, precondition, and batch failures share a stable repair-oriented envelope whose correlation resolves to the failed, denied, or original command; runtime probes cover the transport contract. |
| Typed client contracts | `runtime_proven` | Explicit Planning requests, mutation results, domain/precondition errors, revisions, capabilities, history, and workspace actions replace broad payloads at the browser API boundary and generated OpenAPI is contract-tested. |
| Accessible failure recovery | `runtime_proven` | Chromium proof focuses and announces domain failures with server repair, field, revision, and audit references; stale writes preserve explicit reload/reapply recovery. |
| Typed operation links | `runtime_proven` | Project/task references use server-selected resolvers, actor-specific safe states, Planning revision/audit evidence, baseline capture, and no foreign keys or copied payloads from optional providers; PostgreSQL and candidate lifecycle proof pass. |
| Execution date semantics | `runtime_proven` | Planned dates remain scheduler-owned; forecast, reason-audited actual, and deadline facts use a dedicated typed mutation, project IANA timezone, UTC storage, DST-safe conversion, explicit variances, baseline capture, and PostgreSQL/candidate proof. |
| Task participants | `runtime_proven` | Controlled responsibility roles reference actor-authorized canonical Parties without cross-module foreign keys; revision/version, safe lifecycle states, filtering, baselines, audit, PostgreSQL, candidate, and Chromium proof pass. |
| Task gates and readiness | `runtime_proven` | Controlled requirements use edit/approve authority, matching typed links, reasoned decisions, provider-aware fail-closed readiness, task/project blocker counts, version/audit/baseline integration, and typed UI actions; PostgreSQL, candidate, and Chromium proof pass. |
| K Connect thread jump | `runtime_proven` | `communications.core` owns real organization-scoped thread records and permissions; Planning resolves actor-safe typed links and the shell deep-links to the exact authorized K Connect thread; PostgreSQL, candidate lifecycle, and Chromium proof pass. |

## Grid And Column Features

| Feature | Target behavior | Status |
|---|---|---:|
| Resizable columns | Drag column separator to adjust width; keyboard arrows resize; widths persist locally. | `source_present` |
| Auto-fit columns | Double-click column resize handle/header to fit visible content. | `source_present` |
| Shared column resize primitive | Contacts and Planning use shared resize handle/sizing hook instead of local copies. | `source_present` |
| Field presets | Core, Progress, and Resources column sets. | `source_present` |
| Column visibility | User-selectable individual columns beyond presets. | `source_present` |
| Column header menu | Per-column menu supports sorting, quick action, width reset, hiding non-pinned columns, and restoring visible columns. | `source_present` |
| Column reorder | Drag headers to reorder columns; order persists locally per field preset. | `source_present` |
| Pinned columns | Keep WBS/task pinned ahead of reordered fields and sticky inside the grid. | `source_present` |
| Sort by columns | Sort visible rows by WBS, task, dates, duration, progress, critical flag, assignee, and status. | `source_present` |
| Inline grid edit | Edit task title, start, end, progress, and controlled status cells directly in the grid with server validation; derived/read-only cells stay locked and successful keyboard edits restore focus. | `runtime_proven` |
| Tree summary expander | WBS tree cells expose accessible per-summary expand/collapse controls; nested descendants hide with their collapsed parent. | `source_present` |
| Context row menu | Add below, add child, duplicate, delete, convert to milestone, and status actions. | `source_present` |

## Row And Density Features

| Feature | Target behavior | Status |
|---|---|---:|
| Compact/standard/roomy density | Toolbar-controlled row height modes. | `source_present` |
| Double-click task header to shorten rows | Double-click Task header toggles compact/standard density. | `source_present` |
| Double-click summary row | Double-click summary row toggles that summary branch while toolbar commands expand/collapse all branches. | `source_present` |
| Per-row height | Resize individual rows from a row-bottom separator; keyboard arrows adjust height and per-project overrides persist locally. | `source_present` |
| Auto-height row fit | Double-click or press Enter on a row resize separator to fit that row to its content without breaking grid/timeline alignment. | `source_present` |
| Scroll synchronization | Grid and timeline row alignment must remain stable. | `source_present` |
| Empty visible schedule state | Grid and timeline render a first-party empty state when filters or a project leave no visible tasks. | `source_present` |

## Timeline Features

| Feature | Target behavior | Status |
|---|---|---:|
| Hour/day/week/month/quarter/year scale | Toolbar scale controls and zoom slider. Hour view uses 6-hour visual buckets and explicitly states that subday zoom is visual while server scheduling remains date-based. | `source_present` |
| Today marker | Current date marker and scroll-to-today command. | `source_present` |
| Fit project | Fit button switches to a project-range scale and aligns the timeline viewport to the validated project start/end range. | `source_present` |
| Scroll to selected task | Toolbar command centers the selected task's date on the timeline and returns focus to the selected row. | `source_present` |
| Scroll to date | Date input and Go command center an arbitrary date on the current timeline scale. | `source_present` |
| Project boundary markers | Timeline renders labeled start/end markers from the validated project read model. | `source_present` |
| Task deadline/event markers | Timeline renders first-party visible-task marker flags for critical due dates, baseline variance, and milestones. | `source_present` |
| Drag timeline and controlled wheel zoom | Drag empty timeline/header space to pan; Ctrl/Command wheel steps the existing zoom scale without breaking normal scroll. | `source_present` |
| Click-drag task creation | Hold Shift and drag empty timeline space to draw a date range, then submit a server-validated task proposal. | `source_present` |
| Timeline-only layout | Toolbar toggle hides the grid and gives the timeline the full Gantt workspace width; split view restores the grid. | `source_present` |
| Weekend shading | Non-working weekend visual bands. | `source_present` |
| Holiday shading | Calendar holiday visual bands. | `source_present` |
| Minute/sprint/stage scales | Additional specialized visual scale modes. Minute view uses 30-minute visual buckets; sprint and stage use 14-day and 30-day planning buckets while server scheduling remains date-based. | `source_present` |
| Timeline header grouping | Month/year/week grouping. | `source_present` |
| Ignored periods | Project calendar ignored ranges are persisted, returned in the read model, expanded into non-working dates, and shaded in the timeline. | `source_present` |

## Task Shape And Color Features

| Feature | Target behavior | Status |
|---|---|---:|
| Normal task bars | Render start/end duration bars. | `source_present` |
| Summary bars | Render phase/summary bars distinctly. | `source_present` |
| Milestone diamonds | Render zero-duration milestones. | `source_present` |
| Progress overlay | Inner progress fill shows completion percentage. | `source_present` |
| Status color coding | Not started, in progress, complete, overdue, blocked, critical. | `source_present` |
| Non-color indicators | Labels/icons/patterns so status does not depend on color alone. | `source_present` |
| Selected/hover/focus states | Visible selected and keyboard focus states. | `source_present` |
| Keyboard navigation and hotkeys | Move row focus with arrow/home/end keys and run common task actions by shortcut. | `source_present` |
| Taskbar tooltips | Hover/focus task detail with status, dates, and progress. | `source_present` |
| Resize start/end handles | Drag bar edges to change duration. | `source_present` |
| Progress drag handle | Drag progress handle to update percent through server validation. | `source_present` |

## Dependency Features

| Feature | Target behavior | Status |
|---|---|---:|
| Dependency display | Draw connector paths between visible predecessor/successor tasks. | `source_present` |
| Dependency inspector | Create/update/remove dependency records. | `source_present` |
| Dependency lag/lead | Positive lag and negative lead. | `source_present` |
| Dependency validation | Reject missing refs, self-links, cycles, and invalid date order. | `source_present` |
| Dependency drag creation | Drag from one task to another to link tasks through server validation. | `source_present` |
| Highlight chain | Show selected task predecessors and successors in grid rows, task bars, and dependency paths. | `source_present` |
| Cascade scheduling toggle | Move successors when predecessor dates change, or reject violating predecessor moves when disabled. | `source_present` |

## Scheduling And Python Features

| Feature | Target behavior | Status |
|---|---|---:|
| Server-side validation | Python validates all schedule mutations before UI accepts them; separate result validators recompute CPM hard invariants and resource-capacity results. | `runtime_proven` |
| Topological ordering | Use deterministic dependency graph ordering for propagation, CPM, and cycle checks without UI row-order input. | `unit_tested` |
| CPM read model | Logic-driven early/late dates, total/free float, target variance, engine version, independent validation, and critical flags. | `runtime_proven` |
| Calendar-aware propagation | Respect working days and holidays. | `integration_tested` |
| Resource over-allocation | Compute and independently validate per-resource/day load, effective calendar capacity, contributing tasks, and overload warnings. | `runtime_proven` |
| Resource leveling | Explicit `simple_forward` command uses a bounded configured horizon, moves only eligible auto tasks, and returns leveled/partial/infeasible, exact changed tasks, remaining overloads, stable reasons, audit evidence, and independent post-level validation without changing approved baselines. | `runtime_proven` |
| Constraints | Must-start, must-finish, start/finish no-earlier-than, and start/finish no-later-than constraints are stored per task, enforced by Python scheduling, returned in read models, editable in the inspector, and exported. | `integration_tested` |
| Manual/auto scheduling | Per-task auto/manual scheduling mode is stored with each task; auto tasks participate in dependency propagation, while manual tasks keep their dates and surface validation conflicts. | `integration_tested` |
| Controlled task status | Planned, in-progress, blocked, and complete values use a server-owned registry and transition policy; unknown values and forbidden transitions return structured errors without schedule mutation. | `runtime_proven` |
| Optimistic concurrency | Project revisions and task versions are persisted; actor-visible schedules return canonical strong ETags; existing-project writes require exact `If-Match` and expose typed 428/412 reload/reapply recovery. | `runtime_proven` |

## Workspace And Professional Features

| Feature | Target behavior | Status |
|---|---|---:|
| Board/List/Calendar/Workload/People/Dashboard views | Alternate read-model views use the same validated schedule; Workload includes independently validated daily resource load lanes and overload counts. | `runtime_proven` |
| Fullscreen/focus mode | Expand the planning workspace into a dense viewport overlay with an explicit exit action. | `source_present` |
| Layout mode persistence | Saved views include split/timeline-only layout mode with other Gantt workspace preferences. | `source_present` |
| Review/edit mode | Toolbar toggle prevents schedule mutations by disabling task creation, edit commands, row action menus, drag handles, progress handles, dependency handles, and inspector editor controls. | `runtime_proven` |
| Bulk selection | Select visible rows and submit completion, status/progress, or date-shift intents through one atomic task-update batch. | `runtime_proven` |
| Bulk edit | Project-scoped task updates commit one revision or roll back every operation; owner, priority, and calendar fields remain later work. | `runtime_proven` |
| Atomic mixed mutation | The generated ten-kind contract applies ordered task, dependency, resource-assignment, calendar, typed-link, and gate changes in one transaction with one final schedule validation/revision and capability-safe correlated evidence. | `runtime_proven` |
| Undo/redo | Supported inverse commands use the atomic endpoint with the source command ID and current revision; stale inverses preserve latest server state and unsupported/destructive history kinds fail closed. | `runtime_proven` |
| Saved views | Store filters, density, fields, scale, and grouping. | `source_present` |
| Search/filter/group | Search task titles; filter by status, critical, resource, participant, milestone, and not-ready gate blockers. | `integration_tested` |
| Export/import | Planning uses the separately deployed global artifact boundary for PDF, PNG, HTML/office documents, Excel, iCal, MS Project, and CSV needs; no planning-specific redeployment is required. | `integration_tested` |
| Non-drag mutation access | Start/end, progress, dependency, and task-creation changes remain operable by keyboard and form controls without drag gestures. | `runtime_proven` |
| Focus and stale-state recovery | Successful inline edits restore control focus; rejected stale writes and inverses focus an announced repair alert and do not overwrite latest server state. | `runtime_proven` |
| Audit history | Planning schedule events and source-command references are recorded. | `runtime_proven` |
| Operation Links inspector | A capability-gated inspector creates and removes typed references, labels resolver state, and exposes an Open action only for authorized ready targets, including K Connect communication threads. | `runtime_proven` |
| Planned/forecast/actual/deadline editor | Task inspector labels planned dates, edits forecast/actual/deadline facts, requires a reason for actual changes, shows project timezone/variance, and states the subday boundary. | `runtime_proven` |
| People inspector and participant filter | People inspector selects canonical active Parties, assigns controlled roles, shows safe provider states and ready-only jumps; People view and saved participant filter use the same read model. | `runtime_proven` |
| Gates inspector and readiness views | Gates inspector creates requirements, advances review state, and exposes approval actions only to authorized actors; List/Dashboard and saved not-ready filtering consume the server readiness rollup. | `runtime_proven` |
| K Connect exact-thread workspace jump | An authorized ready Planning link selects the K Connect workspace and exact thread; denied, unavailable, and missing targets expose no unsafe Open action. | `runtime_proven` |

## Current UI Audit And Execution Plan

**Status:** Active alpha.3 polish target.

The live Gantt workspace audit on `http://127.0.0.1:18088/` found these usability issues:

| Issue | Runtime evidence | Execution decision |
|---|---|---|
| Timeline utility toolbar hides too many controls behind horizontal scrolling | The utility region was about `640px` wide while its controls measured about `3781px`; roughly 25 of 60 toolbar controls were initially outside the viewport. | Split utilities into named workflow groups and allow them to wrap as a full-width command surface instead of one horizontally scrolling strip. |
| Controls were grouped by implementation rather than workflow | Saved views, fields, filters, scale, navigation, exports, density, and status toggles shared one long row. | Use grouped command architecture: saved/fields, filters, modes, scale, navigation, exports, and display toggles. |
| Planning header duplicated project context and exposed a standalone Inspector trigger | The separate heading repeated schedule identity above the shared command bar and used additional vertical space for a floating `Show inspector` action. | Remove the redundant heading, keep the project selector/status/task and dependency facts in the command bar, and place `Show inspector` inside Planning controls. Keep `All tasks` for task refinements and `Plan actions`, and leave the `Project schedule`/`Portfolio` scope switch unchanged. |
| Sparse schedules left excessive blank chart height | A two-task plan rendered inside a roughly `720px` Gantt shell. | Use a content-aware Gantt height variable with a practical minimum and maximum while preserving large-schedule scroll behavior. |
| Grid felt tight and had hidden horizontal overflow | Task grid measured smaller than its rendered column content. | Include action/resize affordance width in the grid sizing calculation and keep pinned columns readable. |
| Inspector occupied permanent width even when not needed | The inspector was useful but consumed the secondary work region on wide screens and reduced the timeline comparison area. | Render Planning-owned Inspector content in the shared bounded draggable modal editor popup, preserving direct task/create/dependency/resource openers while keeping selection-only navigation and linking in the timeline. |
| Selected one-day tasks mixed labels, status, baseline, resize/progress, and dependency controls in the same pixels | A `52px` one-day bar placed the external `CRIT` badge over the dependency source handle, left the task label unbounded, and kept every control visible solely because the row was selected. | Reserve deterministic label, badge, baseline, and handle regions; clip visible labels while preserving full accessible text; keep transient controls on hover/focus or coarse pointers. |
| The first-row selected tooltip and task markers obscured the date header | The fixed tooltip was forced visible by selection and painted into the `54px` header; stale marker token names resolved to unreadable black pills. | Keep tooltips transient and within the owning row/chart bounds, scope task-state styling to the direct task bar, and use the current semantic marker tokens in light, dark, and system appearances. |

Acceptance for this polish slice:

- no horizontally hidden primary Gantt toolbar controls at wide desktop widths;
- grouped toolbar controls remain reachable at tablet and narrow widths;
- project selection, status, visible/total task counts, and dependency count remain reachable in the shared command bar without a separate Planning workspace heading;
- `Show inspector` is reachable from Planning controls, `All tasks` remains the task-refinement and `Plan actions` surface, and the `Project schedule`/`Portfolio` scope switch remains available and unchanged;
- chart height is proportional for small schedules and scrolls for larger ones;
- grid/timeline alignment remains stable;
- Inspector opens and closes as an accessible modal, isolates the background, contains focus, restores the opener or stable Planning control, and leaves the closed timeline at full workspace width;
- Inspector moves through the shared pointer, touch, and keyboard popup contract, remains fully reachable at desktop, tablet, narrow, zoomed, and resized viewports, and returns to its standard opening position when reopened;
- narrow task labels, status badges, baseline codes, and dependency handles do not intersect;
- task tooltips do not cover the timeline header or adjacent rows and selected tasks remain uncluttered until interaction;
- deadline, variance, and milestone marker pills use defined semantic colors with readable non-color codes;
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
