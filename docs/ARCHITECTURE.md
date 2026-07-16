# UOK Architecture

**Current candidate:** `UOK-3.1.0-alpha.3`

**Current baseline tag:** `UOK-3.1.0-alpha.2-module-extension-docs-baseline`

## Purpose

UOK is a small modular-monolith kernel for installable business and capability modules. The kernel must stay product-neutral while modules own business behavior, UI surfaces, permissions, data ownership, verification scenarios, and lifecycle evidence.

## System Context

```text
Operator browser
  -> FastAPI UOK host under src/uok/host
     -> stable shared kernel contracts under src/uok/kernel
     -> module packages under modules/<module_name>
     -> validated bounded SQLAlchemy QueuePool per API process
     -> PostgreSQL 18 local candidate database
     -> compiled React assets under src/uok/static/app
```

## Containers

| Container | Location | Responsibility |
|---|---|---|
| Backend host | `src/uok/host` | FastAPI application/lifespan, DI, engine/session/pool ownership, manifest provider resolution, ORM registration, router/command/policy/report composition, and static asset serving. |
| Shared kernel | `src/uok/kernel`, `src/uok/kernel_models.py` | Single declarative metadata contract, host-configured module-runtime port, and product-neutral organization, identity, governance, lifecycle, command-log, and event mappings. |
| Database connectivity | `src/uok/host/database.py`, `src/uok/host/db_pool.py` | Validated process-local SQLAlchemy pooling, stale-connection pre-ping, safe telemetry, bounded timeout behavior, and session lifecycle. |
| Module packages | `modules/<module_name>` | Module manifest, backend package, module-owned ORM mappings, module-local React source and CSS, module tests, migrations, candidate verifier scenarios, and behavior. |
| Frontend shell | `web/src` | React + TypeScript + Vite workbench shell, navigation, shared controls and tokens, typed module surface contract, and generated API/module catalogs. |
| Database baseline | `migrations/001_initial_baseline.sql` | Initial shared candidate schema plus schema-version evidence. Future schema changes must be migration-gated and module-owned where applicable. |
| Candidate verification | `scripts/verify_uok_candidate.ps1`, `modules/*/verify`, `web/e2e` | Release smoke, module-declared candidate scenarios, and Playwright UI proof automation. |

## Current Module Model

- `apps.manager` is the only required control module.
- `contacts.core` is the optional governed Party and Contacts system of record. It owns first-class contact facts, consent evidence, Contacts-specific teams, groups, quality/import state, saved views, external identities, and custom fields while engagement records remain owned by their source modules.
- `calendar.core` is an optional global calendar capability module for organization calendars, events, recurrence, persisted reminder definitions, free-busy-derived availability context, iCalendar export, and a traditional Calendar workspace. In-app/email reminder dispatch and availability-slot schedules are not current capabilities.
- Calendar reads fail closed through actor-visible active Calendar parents; `team` visibility is reserved until a canonical membership provider exists. Public appointment booking remains a separate future `appointments.core` boundary rather than expanding `calendar.core`.
- `planning.core` is an optional capability module for project planning, Python-authoritative schedule validation, dependencies, audit events, and an integrated React Gantt workspace.
- `communications.core` is an optional K Connect capability module for organization-scoped thread identity, access, lifecycle state, audit evidence, and exact authorized deep links.
- Planning Gates A-E are locally runtime-proven; scheduling, write-safety, evidence governance, integrations, analysis, measured scale, shared reach/accessibility, bounded portfolio reads, and production-like closure evidence are recorded in the Planning Gantt traceability map. The stacked draft PRs still require hosted CI, review, and merge, and no local alpha result implies production readiness.
- `agents.core` is a planned optional capability module scaffold for governed agent runbooks, Codex tool binding, human approval gates, and compliance evidence.
- `reports.core` is an optional global capability module for secure report artifact generation, storage, audit, verification, download, and deletion.
- `product.master` is an optional Product/Material master-data capability for tenant-scoped canonical Product Definitions, governed lifecycle, and append-only canonical-name history. Cargo, pricing, inventory, routes, documents, and Party relationships remain outside this owner.
- `planning.core` consumes `calendar.core` for read-only organization availability and free-busy context and uses `reports.core` as an availability-gated optional frontend integration for secure report artifact actions, while Planning-owned Gantt working calendars remain the scheduling authority for task normalization, dependency propagation, and resource leveling.
- Module metadata is read from `modules/<module_name>/manifest.yaml`.
- Backend runtime extension points are declared in manifests; only validated manifest `backend_path` roots enter import resolution, and imported provider origins must remain inside the owning backend.
- Planning, Contacts, and Product Master expose supported Python facades at `uok_planning_core.public_api`, `uok_contacts_core.public_api`, and `uok_product_master.public_api`. All other implementation code is capability-organized below the owner's `_internal` package; external static imports are rejected by `tests/test_module_public_api_boundaries.py`.
- Module-owned ORM mappings remain private even when the model registry resolves their privileged manifest `model_exports` hook. Planning, Contacts, and Product Master export no ORM mapping through a public facade.
- Manifests use closed schema `uok.module.v1`, declare evidence-bounded maturity, reserve canonical non-overlapping API prefixes, and pass runtime validation before extension imports or router composition; release validation separately proves tests and verifier assets.
- The Apps Manager HTTP adapter is owned by `modules/apps.manager` and mounted through the same manifest router mechanism as capability modules; shared lifecycle services provide locked, audited, idempotent reconciliation when persisted control-plane state drifts from current manifest truth.
- Current declared backend extension surfaces include API routers, command handlers, command permissions, command replay guards, role grants, dashboard providers, evidence providers, model exports, and candidate verifier scripts.
- Static runtime validation completes before extension imports. The host-owned deterministic model registry then composes 42 module-owned mappings with nine kernel mappings on the single `uok.kernel.persistence.Base` before migration inspection, schema creation, or router composition.
- Apps Manager, Calendar, Communications, Contacts, Planning, and Product Master own executable React source and local CSS under `modules/<module_name>/web/src`; their frontend tests live under `modules/<module_name>/tests/web`.
- Workbench surfaces declare the release/build extension `web_surface` plus canonical `web_entry` and unique `web_section` metadata in the closed manifest. A deterministic generator validates those manifests and emits literal TypeScript imports in `web/src/generated/moduleSurfaceCatalog.ts` for the typed registry under `web/src/features/modules`.
- Frontend composition is compile-time only. The browser never reads manifest YAML, resolves dynamic module paths, or loads remote module code; Vite compiles the generated catalog and all declared entries into the normal static application bundle.
- Module surfaces receive only the nine-field neutral host port in `web/src/contracts/moduleSurface.ts`, including a monotonic global-refresh revision. Contacts owns its HTTP reads, DTOs, state, preferences, storage keys, and commands; the shell owns only product-neutral auth/layout/navigation/orchestration and keeps visited module roots mounted without importing module internals.
- Durable module workspaces compose one minimal shared command surface with optional query, context, and actions groups plus the common localized action vocabulary accepted in ADR-0025. Shared code owns layout and accessibility; modules retain domain nouns, state, permissions, options, and handlers.
- Product Master owns its complete Product DTO, HTTP, state, command, and workbench surface under `modules/product.master/web/src`. Reports owns the typed report HTTP client under `modules/reports.core/web/src` without declaring a workbench surface. `agents.core` remains an inert planned scaffold with no executable frontend entry.
- Docker copies module production source into the frontend build stage, TypeScript/Vitest discover the module-owned source and test roots, and final-image validation keeps module tests out of the runtime image.

## Boundaries

- `src/uok/host` owns application composition, provider registration, static serving, engine/session infrastructure, authentication/session dependencies, and command dispatch.
- `src/uok/kernel` provides only stable module-neutral persistence, actor/permission, command/error, and module-runtime contracts. Feature modules may use those contracts; exact HTTP/command adapter paths alone may import the documented `get_db`, `current_actor`, and `execute_command` host seams.
- `modules/<module_name>` owns module behavior and must declare every extension point it uses.
- Product, cargo, CRM, accounting, inventory, document, and integration behavior must not be hardcoded into the kernel.
- Product-neutral organization, identity, governance, module-lifecycle, workflow, command-log, and event mappings live in `src/uok/kernel_models.py`. Capability mappings are physically defined in their owning backend packages. The former global `uok.models`, `uok.calendar_models`, and `uok.communication_models` compatibility import paths are retired.
- Module-specific production UI lives in `modules/<module_name>/web/src`, module-specific frontend tests live in `modules/<module_name>/tests/web`, and module CSS is imported from the owning module surface. Product-neutral shell, shared controls, global tokens, generated contracts, and composition remain in `web/src`.
- `web_surface`, `web_entry`, and `web_section` are compile-time composition metadata, not Python import targets or browser runtime loading instructions. Their checked-in generated catalog must match the validated closed manifests.
- Contacts pytest suites live under `modules/contacts.core/tests`; its candidate verifier and evidence composition live under `modules/contacts.core/verify`.
- Planning behavior tests live under `modules/planning.core/tests`; its candidate and production-like runtime verifiers live under `modules/planning.core/verify`.
- API database access currently uses one explicitly bounded SQLAlchemy QueuePool per API process. The executable capacity gate reads `deploy/database-capacity.env`, enforces mandatory reserves offline before Compose, and checks cluster-wide live usage immediately after health before an increased worker or replica deployment is accepted; an external PgBouncer topology remains deferred until measured demand or approved scale requires it.

## Key Decisions

- Documentation index: `docs/DOCUMENTATION_INDEX.md`
- Development continuity system: `docs/architecture/UOK_DEVELOPMENT_CONTINUITY_SYSTEM.md`
- Internal engineering system: `docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md`
- AI worker development model: `docs/architecture/UOK_AI_WORKER_DEVELOPMENT_MODEL.md`
- Code quality and technology audit standard: `docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md`
- ADR-0001: `docs/architecture/ADR-0001-module-extension-runtime-boundaries.md`
- ADR-0002: `docs/architecture/ADR-0002-planning-gantt-and-ui-proof-dependencies.md`
- ADR-0003: `docs/architecture/ADR-0003-planning-gate-a-stabilization.md`
- ADR-0004: `docs/architecture/ADR-0004-planning-typed-link-resolver.md`
- ADR-0005: `docs/architecture/ADR-0005-planning-date-semantics.md`
- ADR-0006: `docs/architecture/ADR-0006-planning-task-participant-boundary.md`
- ADR-0007: `docs/architecture/ADR-0007-planning-task-requirements-and-readiness.md`
- ADR-0008: `docs/architecture/ADR-0008-communications-thread-provider-boundary.md`
- ADR-0009: `docs/architecture/ADR-0009-planning-typed-resource-boundary.md`
- ADR-0010: `docs/architecture/ADR-0010-planning-resource-capacity-calendars.md`
- ADR-0011: `docs/architecture/ADR-0011-planning-resource-calendar-correlation.md`
- ADR-0012: `docs/architecture/ADR-0012-planning-explainable-resource-leveling.md`
- ADR-0013: `docs/architecture/ADR-0013-planning-immutable-what-if-snapshots.md`
- ADR-0014: `docs/architecture/ADR-0014-planning-reproducible-risk-analysis.md`
- ADR-0015: `docs/architecture/ADR-0015-planning-governed-optimization-and-recommendations.md`
- ADR-0016: `docs/architecture/ADR-0016-planning-scale-budgets-and-virtualization.md`
- ADR-0017: `docs/architecture/ADR-0017-uok-localization-bidirectional-and-touch-boundary.md`
- ADR-0018: `docs/architecture/ADR-0018-planning-portfolio-and-release-readiness.md`
- ADR-0019: `docs/architecture/ADR-0019-planning-revision-ledger-and-transactional-outbox.md`
- ADR-0020: `docs/architecture/ADR-0020-planning-project-lifecycle-and-finish-authority.md`
- ADR-0021: `docs/architecture/ADR-0021-module-manifest-runtime-and-release-truth.md`
- ADR-0022: `docs/architecture/ADR-0022-module-owned-orm-registration.md`
- ADR-0023: `docs/architecture/ADR-0023-module-local-frontend-composition.md`
- ADR-0024: `docs/architecture/ADR-0024-database-connection-pooling.md`
- ADR-0025: `docs/architecture/ADR-0025-uniform-workspace-command-surface-and-action-vocabulary.md`
- ADR-0026: `docs/architecture/ADR-0026-calendar-integrity-and-appointments-boundary.md`
- ADR-0027: `docs/architecture/ADR-0027-contacts-system-of-record-governance-and-interoperability.md`
- ADR-0028: `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`
- Module extension contract: `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- Programming stack policy: `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md`
- UI policy: `docs/design/UOK_UI_DESIGN_POLICY.md`
- Standard operations: `docs/operations/UOK_STANDARD_OPERATIONS.md`
- Contacts Core operations: `docs/operations/UOK_CONTACTS_CORE_OPERATIONS.md`
- Database connection-pooling operations: `docs/operations/UOK_DATABASE_CONNECTION_POOLING.md`
- ASUH test events: `docs/operations/UOK_ASUH_TEST_EVENTS.md`
- GitHub engineering guardrails: `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`
- AI operations kernel architecture: `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md`
- Global export artifacts: `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md`
- Global shared features: `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md`
- Module roadmap: `docs/architecture/UOK_MODULE_ROADMAP.md`
- Product and Cargo separation policy: `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md`
- Contacts business intelligence profiles: `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- Product Master module plan: `docs/modules/product.master/PRODUCT_MASTER_MODULE_PLAN.md`
- Party/MDM Product Master slice design: `docs/delivery/party-mdm-slice-design-2026-07-16.md`
- Party/MDM Product Master slice delivery: `docs/delivery/party-mdm-slice-delivery-2026-07-16.md`
- Planning Core module plan: `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`
- Communications Core module plan: `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md`
- Planning Gantt Gate A traceability: `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md`
- Planning Gate B typed links resolve through module-owned adapters; K Connect threads now resolve through `communications.core`, while absent Operation Graph providers remain explicit `unavailable` states rather than simulated source objects.
- Planning reads Contacts, Calendar, Communications, and Reports reference data only through immutable DTO query contracts in each owner's `public_api.py`; `tests/test_planning_data_boundary.py` rejects foreign ORM, schema, repository, infrastructure, broad-facade, and compatibility-registry imports from Planning production code.
- Planning schedule writes append one immutable revision-ledger row and one internal transactional outbox envelope in the same project transaction. This is durable commit evidence only; no dispatcher or external-delivery claim exists.
- Planning projects use a reasoned controlled lifecycle with recoverable read-only archive semantics and hidden internal purge. Exact target commitment and persisted CPM-v2 calculated finish are separate from the compatible `end` horizon; legacy calculated backfill mismatches fail visible and block immutable capture until a scheduler write repairs them.
- Python module service first, with React UI receiving validated schedule read models.
- Planning Gate B execution dates use scheduler-owned planned dates plus separate forecast, reason-audited actual, and deadline facts. Project-local calendar dates are stored as UTC instants through an immutable creation-time IANA timezone; subday Gantt scales remain visual-only.
- Planning Gate B task participants reference canonical, authorized `contacts.core` Parties through actor-specific resolution without a cross-module foreign key. Responsibility roles remain distinct from Gate C capacity resources.
- Planning Gate B requirements use a controlled, permissioned state machine and derive fail-closed task/project readiness from required decisions and actor-visible typed-link provider state.
- Planning Gate B communication jumps keep thread identity and authorization in `communications.core`; Planning stores only a typed reference and the shared shell opens the exact actor-authorized K Connect thread.
- Planning Gate C typed resources are runtime-proven: they separate responsibility from capacity, enforce controlled type/unit/reference combinations, and preserve optional provider boundaries without cross-module foreign keys.
- Planning Gate C resource calendars are runtime-proven: they derive effective daily capacity from resource periods, weekdays, holidays, and bounded exceptions; project calendar dates remain scheduling authority and resource-capacity engine v2 is independently validated.
- Planning Gate C `calendar.core` availability is runtime-proven and correlated by actor-visible canonical Party assignments/participants and exact task IDs; unrelated or private events do not become Planning warnings and no event silently moves a task.
- Planning Gate C simple resource leveling is runtime-proven and returns explicit, independently validated outcomes, exact remaining overloads, stable reasons, and a bounded operator-configured horizon; it remains a deterministic heuristic and is not labeled optimization.
- Planning Gate D what-if snapshots are runtime-proven: complete approved state and temporary typed changes are captured as immutable, hash-verified, audit-correlated artifacts, and previews run on detached task copies without changing approved task fields or versions.
- Planning Gate D risk analysis is runtime-proven: bounded first-party Monte Carlo runs reference verified snapshot checksums and persist normalized distributions, correlations, seed, engine/version, limits, percentiles, confidence assumptions, independent validation, and append-only audit evidence.
- Planning Gate D governed optimization is runtime-proven: a bounded dependency-free advisory engine returns explicit completed/timeout/infeasible evidence and independently validated ranked recommendations that require reasoned approval before apply, fail closed when stale, and support audited rollback.
- Planning Gate E scale budgets are runtime-proven in rollback-only SQLite and PostgreSQL profiles; the measured 500-row browser breach activates a dependency-free shared grid/timeline virtual window only above 200 visible tasks, with synchronized scrolling and accessibility row metadata.
- UOK Gate E localization/reach is runtime-proven through one shared English/Arabic provider and workbench preference owner, logical RTL layout, LTR-isolated Planning chronology, coarse-pointer targets, virtual-boundary focus restoration, narrow/200%-text reflow, persistence, and console-clean Chromium proof.
- Planning Gate E portfolio reads are actor-scoped and bounded to six queries for any populated page; the typed workspace exposes explainable health, aggregate metrics, a common multi-project timeline, filtering, and schedule drill-in without changing scheduling authority.
- Planning Gate E release readiness is a repeatable production-like local profile combining candidate contracts, PostgreSQL scale, persistent CPM and concurrency recovery, live Chromium compatibility/accessibility/console checks, and engineering evidence. It is not a production deployment or `production_ready` claim.
- Calendar Core module plan: `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md`
- Secure reports artifact engine: `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md`
- Planning data-boundary inventory: `docs/architecture/planning-data-boundary-inventory-2026-07-15.md`
- Planning data-boundary fix and verification: `docs/architecture/planning-data-boundary-fix-2026-07-15.md`
- Planning and Contacts size/surface inventory: `docs/architecture/planning-contacts-size-inventory-2026-07-15.md`
- Planning and Contacts size/surface fix and verification: `docs/architecture/planning-contacts-size-fix-2026-07-15.md`
- Kernel/host/shell Gap 3 inventory: `docs/architecture/kernel-host-shell-gap3-inventory-2026-07-16.md`
- Kernel/host/shell Gap 3 fix and verification: `docs/architecture/kernel-host-shell-gap3-fix-2026-07-16.md`
- Modular-monolith structure re-audit: `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`
- Active modular-monolith architecture freeze: `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`

## Verification

Before publishing a candidate, run:

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/validate_container_module_assets.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run test:ui-proof
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Also review source size, module contract validation, source-boundary checks, naming checks, dependency audits, and the Podman compose local candidate smoke before promoting a baseline.

For standardized local operations, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Verify
```

For the focused quality and technology audit gate, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```
