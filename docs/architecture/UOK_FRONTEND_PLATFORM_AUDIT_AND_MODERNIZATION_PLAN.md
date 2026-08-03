# UOK Frontend Platform Audit And Modernization Plan

**Status:** Active architecture audit, implementation baseline, and modernization traceability.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Baseline revision:** `8f84ddc` after protected merge of frontend platform Deliveries 1 through 5.

## Purpose And Scope

This artifact is the canonical whole-frontend audit for the UOK workbench. It covers the React shell, eleven manifest-declared module surfaces, shared components, module-owned components, CSS, localization, state, browser navigation, API integration, accessibility, responsive behavior, performance, security, dependencies, tests, and delivery controls.

It answers four questions:

1. What can be reused safely now?
2. What must be promoted or refactored before reuse?
3. What duplicated or unsafe implementation should be retired?
4. In what order should UOK finish the reusable frontend platform?

Current code, tests, generated catalogs, built assets, live runtime evidence, and protected GitHub checks are authoritative. Counts in this document are a baseline snapshot and must be refreshed when a later delivery changes the relevant architecture.

## 1. Executive Summary

UOK can support a reusable frontend platform for the full application, but it is not finished.

The strongest foundation is architectural ownership. Module UI lives under `modules/<module_name>/web/src`, product-neutral shell and shared code live under `web/src`, the generated catalog validates eleven compile-time surfaces, and architecture tests report no cross-owner frontend cycles. Shared command bars, search, overlays, feedback, localization, tables, design tokens, accessibility gates, dependency policy, and bundle budgets are already real multi-module assets rather than proposals.

The main constraint is incomplete composition. Browser location is initial-load-only, nineteen files implement direct transport separately, several async workspaces can accept stale tenant/session results, all module JavaScript and CSS load eagerly, form and collection contracts are partial, master workspaces repeat controller and visual structure, and the stylesheet has no explicit cascade or container-query architecture.

The target is not a new framework or a generic schema-driven UI. UOK should preserve React, TypeScript, Vite, CSS tokens, module ownership, and compile-time catalog validation. Modernization should add small neutral contracts around navigation, transport, forms, collections, workspace composition, localization, theming, and performance proof while module owners retain DTOs, permissions, validation, commands, and business language.

## Audit Baseline

| Evidence | Baseline result |
|---|---|
| Production TypeScript/TSX files | 393 |
| Frontend CSS | 94 files, 10,722 lines |
| Manifest-declared workbench surfaces | 11 literal compile-time registrations |
| Direct `fetch` owners | 19 files |
| Production `SearchWorkspace` consumers | 12 |
| Production `ResizableDataTable` consumers | 8 |
| CSS media declarations | 77 `@media` blocks, 23 exact forms; 60 width-bearing blocks using 16 distinct widths |
| CSS cascade layers | 0 |
| Current JavaScript bundle | 23 files, 991.67 KiB cumulative raw and 280.89 KiB cumulative gzip; initial entry 226.06 KiB raw and 70.09 KiB gzip; largest deferred chunk 225.14 KiB raw and 61.04 KiB gzip |
| Current CSS bundle | 1 file, 198.30 KiB raw, 26.33 KiB gzip |
| Current unit proof | 186 files, 751 tests |
| Browser proof at Delivery 4 | 24 passed, 1 intentional live-only skip |
| Candidate proof at Delivery 4 | Two immutable-image passes; 12 module verifiers per pass; zero retained disposable resources |

## 2. Current Architecture Findings

### Framework And Composition

- The approved stack is React 19, TypeScript 5, Vite 8, Lucide, and plain CSS tokens. `web/package.json` has only React, React DOM, and Lucide as direct runtime dependencies.
- `web/src/generated/moduleSurfaceCatalog.ts` contains literal imports for all eleven workbench surfaces. The browser does not inspect manifests or load remote code.
- `web/src/features/modules/moduleSurfaceRegistry.tsx` validates the catalog, contains each surface with `ModuleErrorBoundary`, and keeps visited roots mounted to preserve owner state.
- `web/src/contracts/moduleSurface.ts` exposes a product-neutral base host context with an atomic session projection and a registry-owned per-surface activity extension. Module DTOs, API clients, state, preferences, criteria, and commands stay module-owned.

This boundary is sound. The audit found zero cross-owner strongly connected component cycles. The shell must not absorb feature state, and shared code must not encode contact, shipment, calendar, or planning rules.

### Folder And Component Strategy

```text
web/src/
  app/                 product-neutral shell orchestration
  contracts/           neutral host and generated-facing types
  features/modules/    catalog validation and surface hosting
  generated/           checked-in generated API and module catalogs
  shared/              module-neutral controls, layout, feedback, forms,
                       tables, overlays, localization, export, and tokens

modules/<owner>/web/src/
  moduleSurface.tsx    compile-time module entry
  *Workspace.tsx       module-owned workspace composition
  *Api.ts              module-owned endpoint and DTO adapters
  hooks/components     module state, commands, views, and domain widgets
  styles/              module-owned CSS
```

The placement model is reusable. The weakness is that several workspace roots still mix transport, session safety, mutations, view state, and rendering. Product and Location workspaces are each 287 lines and share about 71 percent of their structure; Route and Shipment repeat much of the same lifecycle with additional domain behavior.

### Routing And Navigation

`web/src/app/useWorkbench.ts` reads `?view=` only during initialization. Shell navigation changes React state without writing history, and there is no `popstate`, canonical replacement, route-driven document title, or focus lifecycle. Communications and Shipments parse entity parameters independently. Planning emits `party_id` links, but Contacts does not consume that parameter and selects the first visible record instead.

The shell needs one typed, reactive location authority. Modules should decode and own their entity parameters through a neutral host navigation port.

### State And API Integration

Local UI state and owner-local hooks are appropriate defaults. Server data remains authoritative. The gap is request discipline:

- `web/src/app/useWorkbenchData.ts`, Contacts, and Product, Location, Route, and Shipment workspaces can commit an older session result after a newer session becomes active.
- Product, Location, Route, Shipment core, and Compliance API helpers call the supplied unauthorized handler before rejecting a response. Where an owner passes the global handler directly, a post-request state guard cannot prevent an old `401` from signing out the new session. Shipment document hooks already pass generation-bound callbacks and are the closest existing safe precedent.
- Nineteen frontend files call `fetch` directly with differing JSON, `204`, content-type, error, ETag, cancellation, and unauthorized behavior.
- Client identity uses a longer-lived storage path than the bearer token, so stale identity can drive incorrect capability presentation even though the backend still enforces authorization.
- Browser logout only clears local state. The independently valid bearer token has an eight-hour default lifetime and no token identifier, revocation registry, rotation, or server logout endpoint, so possession still permits replay until expiry.

UOK needs an ABA-safe request-authority generation, a generation-bound unauthorized callback passed into transport before a response is interpreted, abortable requests, normalized transport errors, runtime response decoding, server-rehydrated identity, and a revocable server logout/rotation design. Endpoint definitions and DTO mapping remain module-owned.

### Strengths

- Module-local production ownership and compile-time registration are enforced.
- Shared command/search layout is used by twelve production surfaces.
- Shared overlays have focus containment, nesting, busy dismissal locks, drag behavior, and focus restoration.
- Shared feedback includes empty, async, confirmation, and module render-error primitives.
- Accessibility, logical RTL CSS, dependency integrity, lint, and aggregate bundle budgets are protected gates.
- Planning already has measured virtualization above 200 visible tasks.

### Weaknesses

- URL and UI state can diverge.
- Async session safety is inconsistent.
- API transport and response validation are fragmented.
- The initial entry retains only shell and synchronous surface metadata; each
  compile-time-known module workspace loads on first activation and then stays
  mounted under the retained-surface lifecycle.
- Form, selection, pagination, and saved-view contracts are incomplete.
- Master workspace orchestration and CSS are substantially duplicated.
- Theme bootstrap, cascade ownership, z-index, motion, and breakpoint policy are incomplete.
- Signed-in page heading and async-state presentation are inconsistent.
- Tabs and menus do not yet share a complete keyboard composite contract.

### Performance And Dependency Findings

- The production build emits 23 JavaScript assets and one 198.30 KiB CSS asset. The generated catalog keeps eleven small literal module entries in the initial graph; each entry owns one literal local lazy workspace import. The exact HTML entry is 226.06 KiB raw and 70.09 KiB gzip, and the largest deferred Planning chunk is 225.14 KiB raw and 61.04 KiB gzip.
- The static host sends the full JavaScript asset without negotiated compression and does not apply an explicit immutable policy to hashed assets, so the gzip budget currently measures potential size rather than delivered wire size.
- `web/src/shared/localization/UokLocalization.tsx` creates a new provider value on every parent render and constructs new `Intl.DateTimeFormat` or `Intl.NumberFormat` instances on every format call. Seventy-three localization consumers make this a shared invalidation and allocation boundary.
- `web/src/app/useWorkbench.ts` recreates `moduleHost` on every hook render. Because the registry retains visited module roots, shell-only state changes can propagate into hidden workspaces without a stable host/render boundary.
- Planning correctly virtualizes the owned Gantt above 200 visible tasks, and `web/e2e/planning-scale.spec.ts` measures a 500-row interaction and long tasks. Protected CI runs only the accessibility Playwright spec, while the broader suite defaults to Vite development mode; production chunk requests, transferred bytes, cache behavior, and parse/evaluation cost are not protected.
- Runtime dependency hygiene is strong: the narrow direct production set resolves React, React DOM, Scheduler, and Lucide once each, so the audit found no duplicated heavy UI framework to remove.
- `.github/workflows/uok-ci.yml` is a single serialized candidate job, and feature SHAs can receive both push and pull-request runs. Backend and frontend validation cannot proceed independently, superseded work is not cancelled by a stable concurrency policy, and wall-clock and billable-runner efficiency are not reported separately.

The performance target is measurable: gzip-enabled wire delivery, an initial-entry JavaScript ceiling of 150 KiB gzip, a reviewed async-chunk ceiling, stable same-locale context and `Intl` instances, zero hidden-workspace render calls for shell-only state, and a protected production-build Playwright path that records requests, transferred bytes, interaction timings, and long tasks. CI redesign must improve median wall-clock time without concealing increased billable runner minutes.

### Frontend Security And Hygiene Findings

- Production TS/TSX contains no `dangerouslySetInnerHTML` or direct `innerHTML` rendering path; ordinary server text remains React-escaped.
- Shipment and Planning render backend-provided `open_path` values directly, while Intelligence validates its readiness path first. Current providers generate relative same-origin paths, so this is a defense-in-depth consistency gap rather than a demonstrated active URL injection.
- Browser identity persists longer than the session token and is not strictly server-rehydrated. Local logout does not revoke the independently valid bearer token.
- `web/src/shared/exporting/exportArtifacts.ts` does not neutralize spreadsheet formula prefixes in frontend CSV cells.
- `modules/contacts.core/web/src/ContactExchangeToolsPanel.tsx` calls `file.text()` before applying client-side size/type bounds.
- Direct runtime dependencies are narrow, exact, and deduplicated; `npm --prefix web audit --audit-level=low` currently reports zero vulnerabilities. New packages require proof that existing platform primitives cannot meet the need.

## 3. Reuse Opportunity Matrix

| Area | Current issue | Evidence / reproducible inventory | Reusability opportunity | Recommended shared artifact | Priority | Effort | Expected impact |
|---|---|---|---|---|---|---|---|
| Shell location | Location is parsed only during initialization | `web/src/app/useWorkbench.ts` | One reactive URL authority | `WorkbenchLocation` plus neutral history port | P0 | Medium | Bookmark, reload, Back/Forward, exact deep links |
| Session reads | Stale commits and stale unauthorized dispatch span shell and module requests | `web/src/app/useWorkbenchData.ts`; `modules/contacts.core/web/src/app/useContactData.ts`; `modules/product.master/web/src/productApi.ts`; `modules/locations.core/web/src/locationApi.ts`; `modules/routes.core/web/src/routeApi.ts`; `modules/shipments.core/web/src/shipmentApi.ts`; `modules/compliance.core/web/src/complianceApi.ts` | ABA-safe request lifecycle | Shared generation guard and generation-bound unauthorized callback | P0 | Medium | Prevent cross-session data and logout races |
| HTTP transport | Nineteen production owners implement transport differently | `rg -l "fetch\\(" web/src modules -g "*.ts" -g "*.tsx" -g "!**/*.test.ts" -g "!**/*.test.tsx" -g "!**/tests/**"` | Normalize mechanics without centralizing endpoints | Planned shared HTTP package | P0 | High | Consistent auth, errors, decoding, cancellation |
| Auth session | Local-only logout leaves the bearer token replayable until its default eight-hour expiry | `web/src/app/useAuthState.ts`; `src/uok/host/security.py` | Server-authoritative identity and revocation | Identity bootstrap, token identifier/rotation, and server logout | P0 | High | Bound logout, theft, and shared-device exposure |
| Static delivery | Hashed assets lack compression/cache policy and browser security headers | `src/uok/host/application.py` | Share one host delivery policy | Static response middleware and exact-candidate response-header tests | P0 | Medium | Lower wire size, safe repeat loads, browser defense in depth |
| Module loading | Eleven synchronous surface descriptors plus eleven compile-time-known lazy workspace chunks | `web/src/generated/moduleSurfaceCatalog.ts`; module-local `moduleSurface.tsx`; `web/src/features/modules/moduleSurfaceRegistry.tsx` | Preserve literal owner-local lazy boundaries and retained state | Protected entry/chunk budgets and async loading proof | P0 | High | Completed locally; exact-head hosted CI pending |
| Forms | Field/error/focus rules repeat across editors | `web/src/shared/forms/FieldMessage.tsx`; `modules/contacts.core/web/src/ContactForm.tsx`; `modules/product.master/web/src/ProductEditor.tsx`; `modules/locations.core/web/src/LocationEditor.tsx` | Dependency-free accessible field contract | `FormField`, invalid-focus helper, form summary | P1 | Medium | Consistent validation and keyboard submit |
| Tables | Eight consumers repeat row keyboard selection | `web/src/shared/tables/ResizableDataTable.tsx`; `rg -l "ResizableDataTable" web/src modules -g "*.tsx"` | One selection and roving-focus contract | `useDataGridSelection` in shared tables | P1 | Medium | Correct one-tab-stop table interaction |
| Remote collections | Contacts and Planning repeat pagination/request state | `modules/contacts.core/web/src/app/useContactData.ts`; `modules/planning.core/web/src/PlanningWorkspace.tsx`; `modules/planning.core/web/src/PlanningModuleState.tsx` | Typed request/page controller | `useRemoteCollection` | P1 | Medium | Fewer stale reads and page-reset defects |
| Saved views | Local and server views use competing paths | `web/src/shared/forms/useSavedSearchViews.ts`; `modules/contacts.core/web/src/useContactSavedViews.ts`; `modules/planning.core/web/src/planningViewPersistence.ts` | Store adapter plus versioned codec | `SavedViewStore`, `CollectionQueryState` | P1 | Medium | Safe user scope and forward-compatible views |
| Master workspaces | Product, Location, Route, and Shipment repeat lifecycle and layout | `modules/product.master/web/src/ProductMasterWorkspace.tsx`; `modules/locations.core/web/src/LocationMasterWorkspace.tsx`; `modules/routes.core/web/src/RouteMasterWorkspace.tsx`; `modules/shipments.core/web/src/ShipmentSupportWorkspace.tsx` | Share a neutral frame after owner hooks converge | `EntityWorkspaceFrame` and owner-local controllers | P1 | High | Reduce duplication without domain leakage |
| Activation states | Module owners repeat activation presentation | `modules/contacts.core/web/src/ContactsWorkspace.tsx`; `modules/planning.core/web/src/PlanningModuleState.tsx` | Neutral presentation with owner-provided policy | `ModuleActivationPane` | P1 | Low | Remove obvious markup/action duplication |
| Async entities | Relationship and group search repeat listbox/debounce behavior | `modules/contacts.core/web/src/ContactRelationshipLookup.tsx`; `modules/contacts.core/web/src/ContactGroupsManager.tsx` | Generic typed async option behavior | `AsyncCombobox<T>` | P1 | Medium | Keyboard, cancellation, stale-result consistency |
| Page structure | Signed-in pages lack one visible heading contract | `web/src/App.tsx`; `web/src/shared/layout/WorkflowHeader.tsx`; `modules/planning.core/web/src/PlanningWorkspace.tsx` | Shared page header and focus lifecycle | `WorkspacePage` and `WorkspacePageHeader` | P1 | Medium | Heading, title, focus, action consistency |
| Tabs and menus | Auth/Planning tabs and two menus are ad hoc | `web/src/features/auth/AuthScreen.tsx`; `modules/planning.core/web/src/PlanningInspector.tsx`; `web/src/features/layout/AccountMenu.tsx`; `modules/planning.core/web/src/PlanningTaskContextMenu.tsx` | Complete shared keyboard composites | `Tabs`, roving menu behavior | P2 | Medium | Predictable keyboard and ARIA behavior |
| Theme | Appearance resolves after mount and dark tokens are duplicated | `web/src/design-tokens.css`; `web/src/app/useWorkbenchPreferences.ts` | Pre-paint preference/resolved theme | Theme bootstrap plus resolved `data-theme` | P1 | Medium | Remove theme flash and duplicated dark rules |
| Tokens | Raw z-index, motion, pill, focus, and font-size recipes remain | `web/src/design-tokens.css`; `rg -n "z-index:|border-radius: 999px|transition:|animation:" web/src modules -g "*.css"` | Extend the semantic contract selectively | Z-order, motion, interaction, and density tokens | P1 | Medium | Consistent states and enforceable styling |
| Cascade | No layer contract; specificity rule is disabled | `web/stylelint.config.mjs`; `rg --files web/src modules -g "*.css"` | Explicit ownership order | CSS layer contract | P2 | High | Remove import-order coupling |
| Responsiveness | Sixty width-bearing media blocks use 16 distinct widths | `rg -n "@media" web/src modules -g "*.css"` | Shell breakpoints plus component containers | Container-query migration | P2 | High | Reusable panels in split/dashboard contexts |
| Localization | Shared provider retains mixed shell/business ownership | `web/src/shared/localization/UokLocalization.tsx`; `modules/planning.core/web/src/PlanningWorkspace.tsx` | Compile-time module-owned catalogs | Typed module catalog contract | P2 | High | Scalable language ownership |
| Render stability | Localization values/formatters and `moduleHost` are recreated while visited roots stay mounted | `web/src/shared/localization/UokLocalization.tsx`; `web/src/app/useWorkbench.ts`; `web/src/features/modules/moduleSurfaceRegistry.tsx` | Memoized shared bounda…7 tokens truncated…s, tables, pagination, tabs, menus, and overlays.
4. Workspace frames: page, master/detail, async boundary, activation, and metric composition.
5. Module features: domain DTOs, validation, permissions, commands, workflows, and specialized visualization.

Shared code owns neutral layout and interaction. Modules own nouns, policy, server contracts, and business behavior.

### State Rules

- Keep ephemeral visual state local.
- Move API/session orchestration to owner-local hooks before abstracting a shared controller.
- Use server-authoritative read models and typed runtime decoders.
- Use one monotonic request-authority generation for every async commit and unauthorized decision. Advance it when the token/session, authorization-relevant identity or capability, module operational/lifecycle state, request criteria or selected entity, activation state, or component lifetime invalidates the request; abort on deactivation and unmount where possible.
- Make URL state canonical for active surface and module-owned entity context.
- Store durable personal views server-side; otherwise default to session-scoped or user-scoped storage.
- Preserve visited module drafts while closing transient overlays and cancelling active-only reads on deactivation.

### Forms

- Add a dependency-free `FormField` contract for label, description, error, invalid state, and focus.
- Use actual form submission so Enter works.
- Keep validation, draft shape, server errors, and commands module-owned.
- Add dirty/discard and error-summary behavior only after two real editors prove the same neutral contract.

### Tables And Collections

- Extend the existing table rather than adopting a third-party grid.
- Provide one roving selection model: one tab stop, Arrow/Home/End, Enter/Space, nested-control protection, and selection reconciliation.
- Add a typed remote collection controller for cancellation, criteria debounce, page reset, refreshing, and session safety.
- Version query/saved-view state and adapt local, session, and server stores.
- Keep Calendar date grids and Planning scheduling geometry domain-owned.

### Loading, Empty, And Error States

Use a typed remote state:

```text
idle | loading | success | empty | refreshing | error
```

`EmptyState` means a successful zero result. It is not a loading or failure fallback. Full-page and inline feedback may render differently but must share retry, live-region, and status semantics.

## 7. Migration Roadmap

### Phase 1 - Quick Wins And Enforceable Baseline

| Delivery | Scope | Status | ADR |
|---|---|---|---|
| 1 | Responsive detail foundations | Completed in PR #93, merge `6a7ac0c` | No |
| 2 | Shared feedback and recovery | Completed in PR #94, merge `ccacf8f` | No |
| 3 | Accessibility contracts and protected axe proof | Completed in PR #95, merge `2d9d90c` | No |
| 4 | ESLint/Stylelint, dependency and bundle policy, logical CSS/RTL, hook correctness | Completed in PR #96, merge `b22c9fd` | No |
| 5 | Canonical audit baseline and governance reconciliation | Completed in PR #97, merge `8f84ddc` | No |

Expected outcome: one measured baseline, responsive and accessible shared behavior, protected dependency/style/bundle gates, and a reviewable remaining-delivery sequence.

### Phase 2 - Shared Foundations

| Delivery | Scope | Status | ADR |
|---|---|---|---|
| 6 | Request-authoritative async boundary and generation-bound unauthorized handling across session, capability, operational, criteria, activation, and lifetime changes | In progress: 6a establishes the shell/foundation; 6b adopts Compliance reads; 6c adopts Compliance command authority and reconciliation; 6d adopts Contacts primary list/group/detail reads; 6e adopts Contacts create/update/archive/restore commands plus primary reconciliation and an owner-wide gate; 6f implements and locally qualifies Contacts activity and relationship-options reads plus note/relationship commands under that gate and reconciliation; exact-head hosted CI and the remaining Contacts and other module-owner paths remain phased | ADR-0035 |
| 7 | Shared HTTP transport and runtime response decoding in bounded owner slices | Planned | Yes for the transport/error contract |
| 8 | Server-authoritative identity bootstrap, revocable logout, token rotation, and replay proof | Planned | Yes; dedicated auth-session ADR |
| 9 | Canonical browser navigation and exact entity deep links | Planned | Yes; neutral surface contract changes |
| 10 | Consistent safe internal-link boundary | Planned | No unless provider trust changes |
| 11 | CSV formula neutralization and export proof | Planned | No |
| 12 | Bounded Contacts file ingestion before browser reads | Planned | No |
| 13 | Static compression/cache policy and browser security headers | Planned | Yes; static-delivery and browser-security ADR |
| 14 | Compile-time module code splitting, retained lifecycle, and entry/chunk budgets | Implemented and locally qualified on 2026-08-03; ADR-0023/ADR-0028 amended, 23-asset build and entry/deferred/cumulative budgets pass; exact-head hosted CI pending | ADR-0023 and ADR-0028 amended |
| 15 | Shared form foundation and Product/Contacts pilot | Planned | No without a new dependency |
| 16 | Table selection, remote collection, and versioned saved-view contracts | Planned | Conditional on server query protocol |

Expected outcome: every browser/server boundary has typed ownership, stale sessions cannot commit or sign out a newer session, logout is enforceable server-side, URLs are canonical, files and links are bounded, static delivery is secure and cache-efficient, initial loading is split, and shared form/collection behavior is proven by real consumers.

Delivery 6 is intentionally partitioned. Sub-slice 6a establishes the neutral
contract and shell proof without moving domain behavior into shared code.
Sub-slice 6b starts owner adoption with Compliance list, detail, and history
reads. Sub-slice 6c separates one-time non-abortable Compliance command
dispatch, ticket-guarded captured-intent browser effects, and a retained
server-authoritative list/detail/history reconciliation obligation. Sub-slice
6d adopts independent request-authoritative list, groups, and detail lanes for
the ContactsModuleRoot primary reads. Sub-slice 6e adopts the bounded
primary-party commands `CreateContact`, `UpdateContact` from the form,
inline editor, or mark-ready action, `ArchiveContact`, and `RestoreContact`,
plus current-boundary reconciliation of the primary list, groups, selection,
and selected detail. A shared synchronous owner gate prevents the excluded
legacy commands from racing that reconciliation, while token/generation
replacement clears tenant-owned draft and filter state. Selected-row
`updated_at` is browser-intent freshness evidence only; it is not an ETag or
lost-update guard. Sub-slice 6f implements independent request-authoritative
activity and relationship-options owners plus `AddContactNote`,
`LinkContactRelationship`, `UpdateContactRelationship`, and
`RemoveContactRelationship` under the existing command gate and current-primary
reconciliation; local qualification completed on 2026-08-03 and exact-head
hosted CI remains required. Authenticated activity and
relationship-options responses are private, no-store, and authorization-varying.
Composer/editor effects are current-intent-only, while notes and relationships
remain part of the selected-detail projection rather than redundant reads.
Purge, membership and Groups Manager, merge/dedupe/rollback, Data Tools for
facts, consent, teams, custom fields, and external identities,
import/file/bulk/export, saved views, and the other audited module owners remain
open. A current Contacts detail `403` or `404` clears richer detail state but
retains the separately authorized list projection; immediate mid-session
party-visibility revocation remains a list-reconciliation follow-up. Subsequent
sub-slices migrate those owner paths in bounded groups. Delivery 6 and Top-20
Issue 1 remain open until every identified owner path guards success, error,
loading/finally, host refresh, and unauthorized dispatch and masks epoch-stale
committed state.

### Phase 3 - Feature Refactors

| Delivery | Scope | Status | ADR |
|---|---|---|---|
| 17 | Shared workspace page, document-title, and activation-focus lifecycle | Planned | No |
| 18 | Neutral module activation presentation with owner-provided policy | Planned | No |
| 19 | Structured metric-grid contract and labelled dashboard adoption | Planned | No |
| 20 | Shared Tabs keyboard/ARIA contract and Auth/Planning proof | Planned | No |
| 21 | Shared roving Menu contract and account/context-menu proof | Planned | No |
| 22 | Product and Location workspace controllers and neutral entity frame | Planned | No |
| 23 | Route and Compliance adoption; assess Shipment rather than force it | Planned | No |
| 24 | Contacts query view model, saved-view adapter, request separation, and async-combobox proof | Planned | No |
| 25 | Planning query/presentation boundaries and owner-local decomposition | Planned | No |

Expected outcome: shared contracts replace repeated neutral mechanics while Contacts, Planning, Shipment, Calendar, and other owners retain DTOs, rules, commands, and specialized visual semantics.

### Phase 4 - Platform Standardization And Final Proof

| Delivery | Scope | Status | ADR |
|---|---|---|---|
| 26 | Pre-paint resolved-theme bootstrap and dark/high-contrast reconciliation | Planned | No |
| 27 | Semantic motion and z-order token contract plus evidenced consumer migration | Planned | No |
| 28 | CSS cascade-layer ownership contract and incremental adoption | Planned | Yes for cascade contract |
| 29 | Shell breakpoint allowlist and owner-scoped container-query migration | Planned | No |
| 30 | Module-owned localization catalog contract and incremental owner migration | Planned | Yes for localization ownership |
| 31 | Stable localization values/formatters, `moduleHost`, and hidden-workspace render boundary | Planned | No |
| 32 | Executable shared-component catalog and protected visual baselines | Planned | No with existing tooling |
| 33 | Production-build performance harness, request/transfer evidence, and render-allocation budgets | Planned | No with existing tooling |
| 34 | CI trigger hygiene, cancellation, backend/frontend DAG, and wall-clock/billable evidence | Planned | No |
| 35 | Final whole-frontend audit, issue-status reconciliation, and platform handoff | Planned | No |

Expected outcome: theme, motion, z-order, cascade, render boundaries, and responsive behavior are deterministic; language ownership scales with modules; and independently protected visual, performance, accessibility, and CI evidence supports a final reconciled platform verdict.

Every delivery must merge and qualify before the next begins. Runtime-affecting work requires exact-image health, browser, candidate, and neutrality evidence. Documentation-only governance work ends at protected merge.

## 8. Top 20 Issues

| Rank | Issue | Severity | Evidence | Shared solution | Status |
|---|---|---|---|---|---|
| 1 | Old-session responses can overwrite new-session state or an old `401` can trigger logout | High | Shell, Contacts, Compliance, Product, Location, Route, and Shipment request paths | ABA-safe request boundary plus generation-bound unauthorized callback | In progress: shell and all Compliance paths plus Contacts primary reads and bounded 6e commands are current; 6f activity/relationship-productivity adoption is implemented and locally qualified, with exact-head hosted CI pending; purge, membership/Groups Manager, merge/dedupe/rollback, Data Tools/facts/consent/teams/custom fields/external identities, import/file/bulk/export, saved views, the detail `403`/`404` residual, Product, Location, Route, Shipment, and other inventoried owner paths remain open |
| 2 | Logout leaves the bearer token replayable until its default eight-hour expiry | High | `useAuthState.ts`; `src/uok/host/security.py` | Token identity/revocation, rotation, server logout, and replay tests | Open |
| 3 | Nineteen clients implement transport and response handling separately | High | Direct `fetch` inventory | Shared HTTP mechanics plus module decoders | Open |
| 4 | Client identity outlives token storage and is weakly decoded | Medium | `web/src/shared/session.ts` | Strict server-rehydrated session identity | Open |
| 5 | Authentication and shell download every module workspace | High | Former one-file entry replaced by 23 static assets; entry 226.06 KiB raw/70.09 KiB gzip | Compile-time-known lazy surfaces | Completed locally; exact-head hosted CI pending |
| 6 | URL and active workspace diverge; Back/Forward and copy/reload are incomplete | Medium | `web/src/app/useWorkbench.ts` | Typed reactive location/history contract | Open |
| 7 | Planning-to-Contacts `party_id` link does not select the requested Party | Medium | Planning participant links and Contacts selection initialization | Exact module-owned entity route decoding | Open |
| 8 | Static delivery lacks compression, explicit cache policy, and tested browser security headers | Medium | FastAPI static runtime response and host tests | Static delivery/security middleware and proof | Open |
| 9 | Shared localization values/formatters and `moduleHost` destabilize retained workspace renders | Medium | `UokLocalization.tsx`; `useWorkbench.ts`; retained module registry | Memoized formatter/host values and hidden-render boundary | Open |
| 10 | Master workspace controller and visual structure are duplicated | Medium | Product/Location/Route/Shipment/Compliance | Owner hooks plus neutral frame | Open |
| 11 | Form label/error/focus/submit contracts are repeated | Medium | Contacts, Product, Location, Planning editors | `FormField` and invalid-focus contract | Open |
| 12 | Table row selection and keyboard logic are repeated across eight consumers | Medium | Shared table consumers | Roving selection controller | Open |
| 13 | Saved views can leak between browser users and use competing stores | Medium | `useSavedSearchViews`, Contacts, Planning | User/session-scoped store adapter and codec | Open |
| 14 | CSS has no explicit layer architecture | Medium | 94 CSS files; zero `@layer` | Reviewed cascade contract | Open |
| 15 | Theme resolves after mount and duplicates dark/system rules | Medium | workbench preferences and design tokens | Pre-paint resolved-theme contract | Open |
| 16 | Signed-in pages lack one page heading/title/focus contract | Medium | module roots and `WorkflowHeader` | `WorkspacePageHeader` | Open |
| 17 | Auth/Planning tabs and account/context menus lack complete composite keyboard behavior | Medium | Auth, Planning Inspector, account/context menus | Shared Tabs and roving Menu | Open |
| 18 | Frontend CSV export does not neutralize spreadsheet formulas | Medium | `web/src/shared/exporting/exportArtifacts.ts` | Shared safe-cell normalization | Open |
| 19 | Backend-provided internal paths lack one consistent defense-in-depth boundary | Low/Medium | Shipment and Planning anchors; Intelligence already validates | `safeOpenPath`/`SafeInternalLink` | Open |
| 20 | Shared components lack a catalog and protected visual baselines | Medium | Shared component tests and browser suite | Executable component catalog and production screenshot matrix | Open |

## 9. Refactor Examples

### Repeated Page Layout To Shared Page

```tsx
// Before: module root starts with local heading, status, and action markup.
return <section className="product-workspace">...</section>;

// After: shell-neutral page semantics, module-owned content and commands.
return (
  <WorkspacePage
    title={t("product.title")}
    summary={statusSummary}
    primaryAction={<CommandButton onClick={startCreate}>New product</CommandButton>}
  >
    <ProductCommandSurface />
    <ProductWorkspaceBody />
  </WorkspacePage>
);
```

### Repeated Field Wiring To Shared Field

```tsx
<FormField id="contact-email" label={t("contacts.form.email")} error={emailError}>
  {(controlProps) => (
    <input {...controlProps} value={draft.email} onChange={updateEmail} />
  )}
</FormField>
```

The module still owns `emailError`, the draft, text, and save command.

### Repeated Table Logic To Shared Selection

```tsx
const selection = useDataGridSelection({
  rowIds,
  selectedId,
  onSelect,
  isSelectable: (row) => row.kind !== "group",
});

<ResizableDataTable
  rows={rows}
  rowProps={(row) => selection.rowProps(row.id)}
/>
```

### Repeated Buttons To A Native-Prop API

```tsx
<CommandButton
  type="button"
  disabled={busy}
  onClick={(event) => {
    event.stopPropagation();
    openEditor(record.id);
  }}
>
  Edit
</CommandButton>
```

The shared control should forward safe native button props and events instead of forcing raw button fallbacks.

### Ad Hoc Styling To Tokens

```css
/* Before: representative current declarations from shared overlays/account menu. */
.workspace-context-menu {
  z-index: 45;
}

.session-popover {
  animation: account-menu-in 180ms ease-out;
}

.column-resize-handle {
  border-radius: 999px;
}

/* After */
.workspace-context-menu {
  z-index: var(--uok-z-context-menu);
}

.session-popover {
  animation: account-menu-in var(--uok-motion-fast) var(--uok-ease-standard);
}

.column-resize-handle {
  border-radius: var(--uok-radius-pill);
}
```

## 10. Final Verdict

### Reuse As-Is

- React/TypeScript/Vite and the narrow runtime dependency set.
- Module-local UI ownership and the compile-time manifest/catalog validation model.
- Neutral module surface contract and the retained visited-root lifecycle requirement.
- Shared command/search layout and common action vocabulary.
- Product-neutral request-authority epochs, independent lanes, guarded callbacks, and committed-state freshness checks.
- Shared overlays, confirmation, empty state, render-error containment, locale/direction types and translation API, existing semantic token values, table column utilities, pagination, and Planning virtualization.
- ESLint, Stylelint, dependency, accessibility, test, build, bundle, candidate, and neutrality gates.

### Refactor Into Shared Contracts

- Browser location/history and module entity routes.
- Session-safe async lifecycle and neutral HTTP mechanics.
- Eager module-catalog imports, localization provider/catalog ownership, `Intl` reuse, stable `moduleHost`, and hidden-workspace render containment.
- Form field/error/focus behavior.
- Table selection, remote collection, and saved-view state.
- Workspace page, activation, metric, and master/detail frames.
- Tabs, menu keyboard behavior, theme resolution, token extensions, cascade ownership, and container responsiveness.

### Remove Or Retire

- Feature-local confirmation, popup, drag, and duplicate command-bar implementations.
- Raw field error wiring after shared migration.
- Repeated Enter/Space row-selection helpers after the shared table contract.
- Global unscoped saved-view storage.
- Unvalidated internal path rendering.
- Eager module-workspace imports; synchronous surface metadata remains required
  for navigation and closed-catalog validation.

### Rebuild From Scratch

No complete module workspace, design system, or domain visualization should be rebuilt from scratch. Replace only the unsafe or duplicated mechanism behind existing behavior. Calendar date/time semantics, Contacts business rules, Shipment workflows, and Planning scheduling/Gantt geometry remain owner-specific.

## Validation And Update Rules

Documentation-only updates to this artifact require:

```powershell
python scripts/quality_audit.py
python -m pytest tests/test_naming_policy.py tests/test_frontend_quality_policy.py -q
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```

Runtime deliveries must also execute the applicable frontend gates:

```powershell
npm --prefix web run check:contracts
npm --prefix web run check:dependencies
npm --prefix web run lint
npm --prefix web run lint:styles
npm --prefix web test
npm --prefix web run test:accessibility
npm --prefix web run test:ui-proof
npm --prefix web run build:static
npm --prefix web run check:bundle-budget
```

Update this audit when a top-20 issue changes status, a roadmap delivery merges, a shared artifact is promoted or retired, or an ADR changes the target architecture.
