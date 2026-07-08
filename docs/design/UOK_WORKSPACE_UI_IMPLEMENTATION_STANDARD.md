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
   - Feature-specific UI belongs under `web/src/features/<feature>` or the module-owned surface until it proves reusable.

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

3. Results surface
   - Supports list/detail, table, and cards only when each view has a clear user need.
   - Table behavior such as pagination, sorting, column sizing, and selection must use reusable primitives.

4. Detail or editor surface
   - Selected records use an inspector, sheet, or workspace popup without forcing unnecessary navigation.
   - Create actions must open a blank creation form and must not reuse previously selected record data.

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
- segmented control
- search and filter workspace
- saved views
- data table with accessible resizable columns
- pagination controls
- inline editable field
- workspace popup or sheet
- detail list and status summary
- empty, loading, error, and permission states

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
- shared behavior is in shared primitives;
- feature-specific behavior remains inside the owning feature or module;
- source files remain reviewable under the line-of-code integrity policy;
- tests, build, and relevant audits pass;
- runtime behavior has been verified when the UI changed;
- the owning Markdown artifact reflects the current rule or workflow.
