# UOK Workspace UI Implementation Standard

**Status:** Mandatory implementation standard for UOK workspace UI work.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Applies to:** UOK shell UI, module workspaces, shared frontend primitives, Contacts workspace evolution, future module UI, UI tests, and runtime UI verification.

## Purpose

This standard turns the UOK UI design policy into a repeatable engineering method. It defines the specialist knowledge, component ownership, review gates, and deployment checks needed to build a clean, fast, low-distraction UOK workspace without creating future rewrite work.

Use this document with:

- `docs/design/UOK_UI_DESIGN_POLICY.md`
- `docs/design/UOK_APPLE_HIG_TECHNICAL_REFERENCE.md`
- `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`
- `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`
- the affected module plan under `docs/modules/<module-name>/`

## Specialist Agent Groups

For small UI changes, one implementation agent may cover all roles. For broad workspace changes, use dedicated agents or explicit review passes with these responsibilities:

| Group | Responsibility | Required output |
|---|---|---|
| Product workflow | Defines the user role, task, data state, success path, exception path, and minimum clicks | Workflow notes in the module plan or issue summary |
| Workspace UX | Applies Apple-informed clarity, layout, information hierarchy, search, grouping, forms, and low-distraction interaction | UI structure, interaction decisions, and acceptance checks |
| Frontend architecture | Keeps React + TypeScript files small, typed, composable, and split by responsibility | Shared primitives, feature components, hooks, tests |
| Design system | Maintains tokens, semantic color, icon discipline, focus states, density, and light/dark/system appearance | Token or shared CSS updates, state coverage |
| Accessibility | Verifies keyboard paths, focus order, labels, contrast, zoom behavior, and non-color status meaning | Accessibility checklist evidence |
| Data and API contract | Aligns UI needs with OpenAPI, typed clients, backend filters, pagination, search, and record state | API or typed-client changes plus tests |
| Quality and security | Checks source size, duplication, dependency risk, privacy-sensitive data exposure, and release evidence | Audit and verification results |

Use multiple live agents only when the task has parallelizable work with clear boundaries, such as independent accessibility review, source-size audit, backend contract review, or UI regression testing. Do not create agents for work that can be handled more safely by one focused implementation pass.

## Operating Model

1. Start with the workflow, not the screen.
   - Identify the record type, user role, current state, desired action, exception path, and evidence needed.
   - Remove duplicate commands before adding new controls.

2. Map reusable behavior before coding.
   - If a behavior can be used by more than one module, design it as module-neutral.
   - Shared UI belongs under `web/src/shared`.
   - Module-specific production UI belongs under `modules/<module_name>/web/src`; only product-neutral shell, composition, generated contracts, and shared primitives belong under `web/src`.

3. Keep the workspace calm.
   - Prefer one command surface, one selected-record surface, and one status/evidence surface.
   - Avoid repeated branding, repeated user identity blocks, duplicate filters, nested cards, oversized controls, and decorative layout.

4. Build from shared primitives.
   - Use existing shared controls before creating feature-local variants.
   - Promote repeated feature-local behavior into shared primitives before a third copy exists.

5. Verify in the running workspace.
   - Source checks are necessary but not sufficient for UI work.
   - Runtime checks must verify layout, interaction, appearance, and the absence of console errors when UI behavior changes.

## Standard Workspace Anatomy

Every durable module workspace should use this structure unless the module plan records a justified exception:

1. Shell navigation
   - Global `K` home control, module navigation, and bottom account menu.
   - No repeated UOK brand blocks inside the active workspace.

2. Command and search surface
   - Search, filters, grouping, sort, saved views, view mode, pagination, and primary create action should be organized as one coherent command surface.
   - Do not show the same active filter in multiple competing places.
   - Use the shared workspace command bar for module-neutral layout. It exposes optional query, context, pagination, view, fields, secondary-action, and primary-action slots while keeping module state and business commands inside the owning module.
   - Keep the command bar to at most three labelled groups in stable order: query, context, and actions. Do not use the ARIA `toolbar` role unless the complete toolbar keyboard interaction pattern is implemented.
   - Keep frequent view and field controls plus one trailing create command directly available. When a module has additional low-frequency actions, place them in a labelled supplemental section of the expandable search/options panel; clearing search refinements must not invoke those actions or reset their state.
   - Expandable filter/control panels apply changes live without dismissing. Clear resets refinements while the panel remains available for inspection; Done, Escape, outside activation, and an explicitly applied saved view dismiss and return focus to the trigger. Narrow layouts keep the panel inside the viewport as a one-column surface.

### Common action vocabulary

ADR-0025 defines the shared labels. Modules provide the domain noun and command
handler while reusing these visible terms and shared localization keys.

| Intent | Label and placement |
|---|---|
| Search and default set | `Search <plural noun>` and `All <plural noun>` in query |
| Open existing content | `Open` or `Open <singular noun>` on the owning row, card, result, or contextual action area |
| Close a transient surface | `Close` in shared popup, editor, or transient-surface chrome or actions; do not add it as a duplicate workspace command |
| Top-level creation | One trailing primary `New <singular noun>` action |
| Nested association | `Add <noun>` inside the owning record workflow |
| Refine and present | `Filters`, `Sort`, `Group by`, `Saved views`, `Fields`, and `View` |
| Reload and history | `Refresh`, `Undo`, and `Redo`; low frequency may use a labelled supplemental section |
| Output | `Export` or `Export <format>`, and `Print`; use labelled supplemental actions unless output is central to the workflow |
| Reset and dismiss options | `Clear all` keeps the panel available; `Done` dismisses and restores focus |
| Edit workflow | `Edit`, `Save`, `Discard`, and `Cancel` according to whether dirty work exists |
| Destructive versus relational | `Delete` destroys the record and is contextual/destructive; `Remove` detaches a relationship |

Keep unavailable commands visible but disabled when discoverability matters, use
an inline loading state for committed work, and do not use a vocabulary change
to hide a permission or validation failure. Record a justified exception in the
owning module plan.

For user-managed records, visible `Delete` may map to an owning module's
retained soft-delete or recoverable archive lifecycle. The confirmation must
name the selected record, explain retained children/history and restoration,
and use the shared draggable confirmation primitive. Generated or system-owned
records are never made deletable through client-side heuristics. A stale
destructive request reloads authoritative state and requires a new explicit
confirmation; it is not eligible for generic automatic reapply.

3. Results surface
   - Supports list/detail, table, and cards only when each view has a clear user need.
   - Table behavior such as pagination, sorting, column sizing, and selection must use reusable primitives.

4. Detail or editor surface
   - Selected records use an inspector, sheet, or workspace popup without forcing unnecessary navigation.
   - Create actions must open a blank creation form and must not reuse previously selected record data.

### Shared modal overlay contract

`WorkspacePopup` and `WorkspaceEditorPopup` under `web/src/shared/overlays` are the
module-neutral modal boundary. They must contain keyboard focus while open,
isolate background branches with `inert` and `aria-hidden`, and restore every
pre-existing property and attribute value exactly when the modal closes. Focus
returns to the opener when it still exists; when a successful workflow replaces
that trigger, the owning module must focus a stable replacement control or
workspace region.

Committed asynchronous work must set `dismissible={false}` so Escape, backdrop
activation, and the close control cannot dismiss the modal until the operation
settles. The close control must provide at least a 44-by-44 CSS-pixel target for
coarse pointers. Shared overlay labels and controls, plus module-owned title,
description, fields, actions, validation, and status text, must use the shared
UOK localization provider rather than hard-coded visible strings.

Nested overlays participate in the shared overlay stack. Only the topmost open
popup or context menu may process Escape or contain the active Tab cycle; a
parent expandable panel must remain open while its child confirmation is
active. Closing the child restores focus inside the parent, and only a later,
separate dismissal may close the parent. Modules must not add document-level
keyboard handlers that bypass this stack.

Destructive and consequential confirmations use the shared
`ConfirmationDialog` directly or through `ConfirmCommandButton`. The shared
dialog owns `alertdialog` semantics, async submission, nondismissible committed
work, actionable error reporting, optional required reasons, and focus
restoration. Shell or module code must not introduce a second confirmation
backdrop, focus trap, or button implementation.

Every `WorkspacePopup` and `WorkspaceEditorPopup` is draggable through the
shared overlay implementation rather than module-local handlers. A dedicated
localized move handle must support pointer and touch movement with pointer
capture and provide an equivalent keyboard path: Arrow keys move by a small
step, Shift+Arrow moves by a larger step, and Home returns the popup to its
opening position. Moving the popup must not start from fields, links, editor
actions, or the close control, and completing a drag must not activate backdrop
dismissal.

Popup movement is transient for the current opening. Each new opening starts
at its standard opening position, and movement plus viewport changes must clamp the complete popup to
the safe viewport so its move handle, close control, and content cannot become
unreachable at desktop, tablet, narrow, zoomed, or coarse-pointer layouts. The
draggable behavior must preserve the modal focus trap, background isolation,
focus restoration, scrolling, `dismissible={false}` behavior, and localized
accessible instructions.

5. Status and evidence surface
   - Human-readable state comes before raw JSON.
   - Technical evidence can be available through disclosure or developer-oriented panels, not as the main user experience.

## Shared Primitive Promotion Rules

| Pattern | Rule |
|---|---|
| First use | Feature-local implementation is acceptable when narrow and isolated |
| Second use | Evaluate whether the behavior is module-neutral and should move to `web/src/shared` |
| Third use | Promote to shared primitive or document why it must remain feature-specific |
| Global shell behavior | Must be shared immediately |
| Data-grid behavior | Must be reusable unless tied to one module's domain rules |
| Popup, inline edit, saved view, filter, grouping, sort, pagination, and column resize behavior | Must be reusable by default |

Required shared primitives include:

- app shell and navigation
- account menu
- command button and icon button
- workspace command bar with responsive query, context, and action grouping
- segmented control
- search and filter workspace
- saved views
- data table with accessible resizable columns
- data table column visibility for optional data points
- list display-field visibility for compact secondary identity lanes
- one consistent toolbar-level `Fields` control for active-view field visibility when multiple result views expose optional fields
- pagination controls
- inline editable field
- workspace popup or sheet
- detail list and status summary
- empty, loading, error, and permission states

Module surfaces are contained by the shared module error boundary. A render
failure in one module must leave shell navigation and other module roots
operable, show the shared error state without exposing stack details, and offer
a bounded retry. Shared `AsyncState` is the canonical module-neutral
loading/error/empty feedback surface; domain-specific recovery context remains
module-owned.

## Coding Rules

- Durable UI code must remain React + TypeScript + Vite.
- CSS must use semantic tokens and be split by design-system layer, shell, shared primitive, or feature surface.
- React components and hooks should generally stay under `300` lines.
- Avoid mixed files that combine API mapping, view state, layout, validation, and rendering.
- Use typed props, explicit state names, and narrow hooks.
- Keep backend route composition thin when UI changes require API support.
- Use generated or typed API clients when backend contracts are touched.
- Do not introduce one-off dependencies for UI behavior that can be implemented with existing stack patterns.

## Verification Gates

Run the relevant gates before UI work is complete:

```powershell
npm --prefix web test
npm --prefix web run test:ui-proof
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

When runtime UI behavior changes, also verify:

- the local UOK stack loads the affected workspace;
- no browser console errors are introduced;
- light, dark, and system appearance render the workflow;
- keyboard navigation reaches the main controls in a logical order;
- critical text fits at desktop, tablet, and narrow widths;
- selected, hover, focus, disabled, loading, invalid, and destructive states remain visible;
- the workflow has no duplicate or contradictory controls.

The standardized wrapper is:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action UiProof
```

For meaningful feature work, generate engineering evidence:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action EngineeringEvidence
```

## Contacts Reference Implementation

The Contacts workspace is the current reference implementation for:

- unified search, filters, grouping, sorting, saved views, pagination, and view mode controls;
- list/detail, table, and card workspace modes;
- reusable popup editing without leaving the workspace;
- contact relationships and group workflows;
- resizable columns as a shared data-table capability.

Future modules should reuse the shared primitives proven in Contacts instead of rebuilding them locally.

## Completion Criteria

A UI implementation is complete only when:

- the workflow is understandable without developer explanation;
- duplicated controls have been removed or justified;
- the command surface uses stable query, context, and actions grouping, no more than one primary action, and the ADR-0025 common vocabulary;
- cross-module UI proof covers command reachability, focus, narrow and enlarged-text reflow, localization, and appearance when the shared command boundary changes;
- shared behavior is in shared primitives;
- feature-specific behavior remains inside the owning feature or module;
- source files remain reviewable under the line-of-code integrity policy;
- tests, build, and relevant audits pass;
- runtime behavior has been verified when the UI changed;
- the owning Markdown artifact reflects the current rule or workflow.
