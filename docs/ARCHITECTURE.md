# UOK Architecture

**Current candidate:** `UOK-3.1.0-alpha.3`

**Current baseline tag:** `UOK-3.1.0-alpha.2-module-extension-docs-baseline`

## Purpose

UOK is a small modular-monolith kernel for installable business and capability modules. The kernel must stay product-neutral while modules own business behavior, UI surfaces, permissions, data ownership, verification scenarios, and lifecycle evidence.

## System Context

```text
Operator browser
  -> FastAPI UOK runtime
     -> runtime kernel under src/uok
     -> module packages under modules/<module_name>
     -> PostgreSQL 18 local candidate database
     -> compiled React assets under src/uok/static/app
```

## Containers

| Container | Location | Responsibility |
|---|---|---|
| Backend kernel | `src/uok` | FastAPI composition, auth/session security, command bus, module registry, lifecycle APIs, static asset serving, baseline evidence, migration gates, compatibility facades. |
| Module packages | `modules/<module_name>` | Module manifest, backend package, UI ownership marker, module-owned migrations, tests, candidate verifier scenarios, module-owned behavior. |
| Frontend shell | `web/src` | React + TypeScript + Vite workbench, navigation shell, shared controls, module surface registry, generated API contracts. |
| Database baseline | `migrations/001_initial_baseline.sql` | Initial shared candidate schema plus schema-version evidence. Future schema changes must be migration-gated and module-owned where applicable. |
| Candidate verification | `scripts/verify_uok_candidate.ps1`, `modules/*/tests/verify`, `web/e2e` | Release smoke, module-declared candidate scenarios, and Playwright UI proof automation. |

## Current Module Model

- `apps.manager` is the only required control module.
- `contacts.core` is the first optional capability module.
- `calendar.core` is an optional global calendar capability module for organization calendars, events, recurrence, reminders, free-busy, availability, iCalendar export, and a traditional Calendar workspace.
- `planning.core` is an optional capability module for project planning, Python-authoritative schedule validation, dependencies, audit events, and an integrated React Gantt workspace.
- `communications.core` is an optional K Connect capability module for organization-scoped thread identity, access, lifecycle state, audit evidence, and exact authorized deep links.
- Planning Gate A local/runtime closure and all five Gate B slices are verified; scheduling, write-safety, evidence-governance, accessibility, operation links, date semantics, participants, gates/readiness, and K Connect thread-jump claims are recorded in the Planning Gantt implementation traceability map. The stacked draft PRs still require hosted CI, review, and merge, and no local alpha result implies production readiness.
- `agents.core` is a planned optional capability module scaffold for governed agent runbooks, Codex tool binding, human approval gates, and compliance evidence.
- `reports.core` is an optional global capability module for secure report artifact generation, storage, audit, verification, download, and deletion.
- `planning.core` consumes `calendar.core` for read-only organization availability and free-busy context, while Planning-owned Gantt working calendars remain the scheduling authority for task normalization, dependency propagation, and resource leveling.
- Module metadata is read from `modules/<module_name>/manifest.yaml`.
- Backend runtime extension points are declared in manifests and resolved from module backend packages.
- Current declared backend extension surfaces include API routers, command handlers, command permissions, role grants, dashboard providers, evidence providers, model exports, and candidate verifier scripts.
- The frontend uses a compile-time module surface registry in `web/src/features/modules`; this is intentionally not runtime code loading from YAML yet.

## Boundaries

- `src/uok` may provide shared services, shared database primitives, static serving, module composition, and compatibility facades.
- `modules/<module_name>` owns module behavior and must declare every extension point it uses.
- Product, cargo, CRM, accounting, inventory, document, and integration behavior must not be hardcoded into the kernel.
- Shared baseline SQLAlchemy models currently remain in `src/uok/models.py`; module packages import their owned domain models through module-local facades and declare owned tables for validation.
- Module-specific UI still lives in `web/src/features/<feature>` for this candidate, with ownership and composition expressed through the frontend module surface registry and module manifest `web_path`.
- Contacts pytest suites and the Contacts candidate verifier scenario now live under `modules/contacts.core/tests`.
- Planning behavior tests and the Planning candidate verifier scenario live under `modules/planning.core/tests`.

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
- Module extension contract: `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`
- Programming stack policy: `docs/architecture/UOK_PROGRAMMING_LANGUAGE_STACK_POLICY.md`
- UI policy: `docs/design/UOK_UI_DESIGN_POLICY.md`
- Standard operations: `docs/operations/UOK_STANDARD_OPERATIONS.md`
- ASUH test events: `docs/operations/UOK_ASUH_TEST_EVENTS.md`
- GitHub engineering guardrails: `docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md`
- AI operations kernel architecture: `docs/architecture/UOK_AI_OPERATIONS_KERNEL_ARCHITECTURE.md`
- Global export artifacts: `docs/architecture/UOK_GLOBAL_EXPORT_ARTIFACTS.md`
- Global shared features: `docs/architecture/UOK_GLOBAL_SHARED_FEATURES.md`
- Module roadmap: `docs/architecture/UOK_MODULE_ROADMAP.md`
- Contacts business intelligence profiles: `docs/architecture/UOK_CONTACT_BUSINESS_INTELLIGENCE_PROFILES.md`
- Planning Core module plan: `docs/modules/planning.core/PLANNING_CORE_MODULE_PLAN.md`
- Communications Core module plan: `docs/modules/communications.core/COMMUNICATIONS_CORE_MODULE_PLAN.md`
- Planning Gantt Gate A traceability: `docs/modules/planning.core/PLANNING_GANTT_IMPLEMENTATION_TRACEABILITY.md`
- Planning Gate B typed links resolve through module-owned adapters; K Connect threads now resolve through `communications.core`, while absent Operation Graph providers remain explicit `unavailable` states rather than simulated source objects.
- Planning Gate B execution dates use scheduler-owned planned dates plus separate forecast, reason-audited actual, and deadline facts. Project-local calendar dates are stored as UTC instants through an immutable creation-time IANA timezone; subday Gantt scales remain visual-only.
- Planning Gate B task participants reference canonical, authorized `contacts.core` Parties through actor-specific resolution without a cross-module foreign key. Responsibility roles remain distinct from Gate C capacity resources.
- Planning Gate B requirements use a controlled, permissioned state machine and derive fail-closed task/project readiness from required decisions and actor-visible typed-link provider state.
- Planning Gate B communication jumps keep thread identity and authorization in `communications.core`; Planning stores only a typed reference and the shared shell opens the exact actor-authorized K Connect thread.
- Planning Gate C typed resources are runtime-proven: they separate responsibility from capacity, enforce controlled type/unit/reference combinations, and preserve optional provider boundaries without cross-module foreign keys.
- Planning Gate C resource calendars are runtime-proven: they derive effective daily capacity from resource periods, weekdays, holidays, and bounded exceptions; project calendar dates remain scheduling authority and resource-capacity engine v2 is independently validated.
- Planning Gate C `calendar.core` availability is runtime-proven and correlated by actor-visible canonical Party assignments/participants and exact task IDs; unrelated or private events do not become Planning warnings and no event silently moves a task.
- Calendar Core module plan: `docs/modules/calendar.core/CALENDAR_CORE_MODULE_PLAN.md`
- Secure reports artifact engine: `docs/reports/SECURE_REPORTS_ARTIFACT_ENGINE.md`

## Verification

Before publishing a candidate, run:

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest -q
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
