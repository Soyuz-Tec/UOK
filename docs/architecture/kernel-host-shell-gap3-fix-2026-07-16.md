# Kernel, Host, And Frontend Shell Gap 3 Fix – 2026-07-16

**Status:** Implemented and locally verified; hosted CI status is recorded
below.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Purpose

Record the behavior-preserving Gap 3 refactor that separated host composition
from stable shared code and removed the frontend shell–Contacts dependency
cycle. Gap 1 Planning data ownership and Gap 2 Planning/Contacts public facade
rules remain unchanged.

## 1. Before/After Ownership

`pre-gap3:` identifies a repository path at the inventory commit; those files
were deliberately removed by this refactor.

| Responsibility | Before | After |
|---|---|---|
| FastAPI app, lifespan, static serving, global errors, routers | `pre-gap3:src/uok/main.py` | `src/uok/host/application.py` |
| Engine, bounded pool, session factory, request dependency | `pre-gap3:src/uok/db.py`, `pre-gap3:src/uok/db_pool.py` | `src/uok/host/database.py`, `src/uok/host/db_pool.py` |
| Declarative metadata contract | `uok.db.Base`, coupled to engine/session creation | `src/uok/kernel/persistence.py:Base`, with no engine/session import |
| Manifest backend paths and dynamic imports | `pre-gap3:src/uok/module_paths.py`, `pre-gap3:src/uok/module_imports.py` | `src/uok/host/module_paths.py`, `src/uok/host/module_imports.py` |
| Manifest-only ORM registration | `pre-gap3:src/uok/module_model_registry.py` | `src/uok/host/model_registry.py` |
| Router/command/policy/report composition | Root `src/uok/module_*.py` registries | `src/uok/host/module_*.py` registries |
| Feature access to module lifecycle/catalog behavior | Direct imports of `uok.module_ops`, `uok.module_dependencies`, and `uok.modules` | Calls through `src/uok/kernel/module_runtime.py`, configured by the host |
| Actor and permission contract | `pre-gap3:src/uok/security.py`, mixed with token parsing, FastAPI, DB lookup, and manifest grants | `src/uok/kernel/security.py` contract/port; `src/uok/host/security.py` token and request dependency; host-configured grants |
| Command/error contract and dispatch | `pre-gap3:src/uok/command_context.py` plus mixed `pre-gap3:src/uok/commands.py` | `src/uok/kernel/command_contracts.py` contracts; `src/uok/host/commands.py` persistence and provider dispatch |
| Global ORM compatibility imports | `uok.models`, `uok.calendar_models`, `uok.communication_models` | Removed; explicit kernel owner or owner-private module mapping imports |
| Feature framework/dispatch adapters | `pre-gap3:uok.db.get_db`, `pre-gap3:uok.security.current_actor`, `pre-gap3:uok.commands.execute_command` | Exact documented path-and-symbol imports from `uok.host.database`, `uok.host.security`, and `uok.host.commands` |

The host now owns application bootstrap, DI, session/pool construction,
token/session validation, command dispatch, manifest provider resolution, ORM
registration, and global/module composition. The shared kernel additions are
the declarative `Base`, framework-neutral module runtime and permission ports,
immutable actor type, and transport-neutral command/error contracts.
Product-neutral mapped control records remain in `src/uok/kernel_models.py`;
capability mappings remain exclusively in their owning modules.

The exact `uok.host.database.get_db` and
`uok.host.security.current_actor` imports are allowed only in these 12 HTTP
adapters:

- `modules/apps.manager/backend/uok_apps_manager/api.py`
- `modules/calendar.core/backend/uok_calendar_core/api.py`
- `modules/communications.core/backend/uok_communications_core/api.py`
- `modules/reports.core/backend/uok_reports_core/api.py`
- `modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api.py`
- `modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_groups.py`
- `modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_system.py`
- `modules/planning.core/backend/uok_planning_core/_internal/analysis/analysis_api.py`
- `modules/planning.core/backend/uok_planning_core/_internal/delivery/api.py`
- `modules/planning.core/backend/uok_planning_core/_internal/portfolio_audit/portfolio_api.py`
- `modules/planning.core/backend/uok_planning_core/_internal/portfolio_audit/revision_api.py`
- `modules/planning.core/backend/uok_planning_core/_internal/resources/resource_calendar_api.py`

The exact `uok.host.commands.execute_command` import is additionally allowed
only in:

- `modules/calendar.core/backend/uok_calendar_core/api.py`
- `modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_support.py`
- `modules/planning.core/backend/uok_planning_core/_internal/delivery/api_support.py`

The architecture test rejects every other direct or transitive
host/composition dependency, rejects `engine` or `SessionLocal` imports from
feature production code, and allows lifecycle mutation wrappers only in
Apps Manager.

## 2. Shell–Contacts Dependency

### Before

The shell imported Contacts hooks and constants from
`modules/contacts.core/web/src/moduleSurface.tsx`. The surface and hooks imported
the shell-owned `ModuleSurfaceHostContext`, `WorkbenchData`,
`WorkbenchActions`, and preference types. Shell app/shared code also owned
Contacts routes, DTOs, draft/filter state, storage keys, and commands.

At the inventory commit, the TypeScript import/source graph contained 285
production TS/TSX files and 79 components. One 207-file strongly connected
component mixed shell and module owners. Representative cycles are recorded in
`docs/architecture/kernel-host-shell-gap3-inventory-2026-07-16.md`.

### After

- `web/src/contracts/moduleSurface.ts` defines a nine-field neutral host
  context with no shell implementation or feature imports; the ninth field is
  a monotonic global module-refresh revision.
- `web/src/generated/moduleSurfaceCatalog.ts` is the only shell source that
  imports module code, and it imports only exact `moduleSurface.tsx` entries.
- `web/src/generated/moduleSections.ts` carries pure navigation section types,
  so shared shell types do not import the runtime catalog.
- `modules/contacts.core/web/src/ContactsModuleRoot.tsx` owns Contacts
  orchestration.
- `modules/contacts.core/web/src/app/useContactData.ts`,
  `useContactPreferences.ts`, `useContactCommands.ts`, and
  `useContactWorkspaceState.ts` own reads, preferences, commands, and state.
- `modules/contacts.core/web/src/contracts.ts` and
  `contactWorkspaceOptions.ts` own Contacts DTOs/options.
- `web/src/app` and `web/src/shared` contain no Contacts API route, Contacts
  command, Contacts DTO, or Contacts preference/storage declaration.
- `web/src/features/modules/moduleSurfaceRegistry.tsx` lazily mounts visited
  module roots and keeps them mounted while inactive, preserving owner-local
  filters, selection, pagination, and unsaved drafts without a shell import.
- A module-reported 401 invokes the host session workflow, clearing both auth
  and all host-scoped tenant data. Account-menu Refresh reloads host data and
  advances the neutral revision consumed by Contacts owner-local reads.

**Cycle broken:** Yes.

Proof from `tests/test_kernel_host_backend_boundaries.py` and
`tests/test_kernel_host_shell_boundaries.py`:

- zero strongly connected components contain both shell and module owners,
  including type-only, re-export, dynamic, and side-effect imports;
- zero feature production imports target shell app/features/runtime catalog;
- zero shell imports target module code outside the generated catalog;
- focused behavior tests prove visited state retention, complete unauthorized
  cleanup, and owner-local refresh propagation;
- the only remaining source SCC is Planning-internal
  `planningApi.ts` ↔ `planningApiErrors.ts`, outside the shell/Contacts boundary.

The current graph contains 291 production TS/TSX files and 290 components. The
only non-singleton component is that two-file Planning-internal SCC.

## 3. Architecture Gates And CI

| Gate | Command / discovery | Result |
|---|---|---|
| Gap 1 Planning data ownership | `tests/test_planning_data_boundary.py` | Pass |
| Gap 2 public-only Planning/Contacts imports | `tests/test_module_public_api_boundaries.py` | Pass |
| Gap 3 kernel/host boundaries | `tests/test_kernel_host_backend_boundaries.py`, `tests/test_module_runtime_port.py` | Pass |
| Gap 3 frontend shell boundaries | `tests/test_kernel_host_shell_boundaries.py` | Pass |
| Host-configured module runtime port | `tests/test_module_runtime_port.py` | Pass |
| Focused architecture suite | `python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py` | Pass: 33 tests |
| Generated OpenAPI/frontend catalog drift | `npm --prefix web run check:contracts` | Pass |
| Frontend behavior | `npm --prefix web test` | Pass: 110 files / 395 tests |
| Frontend production build | `npm --prefix web run build:static` | Pass |
| Browser/UI proof | `npm --prefix web run test:ui-proof` | Pass: 19 passed / 1 expected live-only skip |
| Full Python repository runner | `python scripts/run_python_tests.py` | Pass: 117 / 117 isolated test files |
| Container module assets | `python scripts/validate_container_module_assets.py` | Pass: six runtime-proven verifier assets |
| Repository quality/documentation policy | `python scripts/quality_audit.py` | Pass |
| Rebuilt local runtime | `uok_ops.ps1 -Action Rebuild` | Pass: new host entrypoint healthy at `127.0.0.1:18088`; offline/live database-capacity gates pass |
| Module candidate verification | `scripts/verify_uok_candidate.ps1` | Pass: Apps Manager, Calendar, Communications, Contacts, Planning, and Reports |
| GitHub Actions candidate checks | Existing workflow discovers all repository tests | Prior implementation push `5c17907` passed; final review-fix commit pending |

Run locally:

```powershell
python -m compileall -q src modules tests conftest.py
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/quality_audit.py
python scripts/validate_container_module_assets.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
```

The existing `.github/workflows/uok-ci.yml` candidate-check job runs
`scripts/run_python_tests.py`, so the new architecture tests are mandatory in
CI without a second partial test catalog.

## 4. Residual Risks

1. Exact feature adapters still import Host `get_db`, `current_actor`, or
   `execute_command`. These are path-and-symbol allowlisted framework/dispatch
   seams, not domain dependencies. A future extraction would replace them with
   injected unit-of-work, actor-context, and command-bus adapters.
2. `ModuleRuntimePort` and the security role-grant port are configured once per
   process through host bootstrap. Direct feature execution without deliberate
   composition fails explicitly.
3. Manifest providers remain privileged in-process extension hooks. Static
   validation, source-origin checks, deterministic registration, and immutable
   registry checks remain the trust boundary.
4. Planning retains one two-file internal frontend SCC
   (`planningApi.ts` ↔ `planningApiErrors.ts`). It does not cross a module or
   shell boundary and is outside Gap 3.

No Planning/Contacts Python facade symbol was added or widened. Planning remains
at seven supported exports and Contacts at eight. No cross-module ORM read,
foreign join, table ownership, tenant rule, authorization rule, audit behavior,
product behavior, or UI workflow changed.

## 5. Mini Scorecard

| Area | Score (1–5) | Justification |
|---|---:|---|
| Module boundaries | 5 | Capability code is module-owned; host composition and exact framework adapter exceptions are explicit and tested. |
| Module size | 4 | Gap 2 internal packaging and narrow facades remain; Planning and Contacts are still substantial capabilities. |
| Data ownership | 5 | Owner-local mappings and Gap 1 foreign-ORM enforcement remain green; global ORM compatibility access is retired. |
| Public API discipline | 5 | Planning/Contacts retain exact facades; frontend modules expose renderer-only entries and neutral ports. |
| Shared kernel | 4 | Kernel additions are framework-neutral persistence, actor/permission, command/error, and runtime contracts; process-global port configuration remains a platform coupling. |
| Communication quality | 4 | Public DTO APIs and explicit ports dominate; exact in-process framework/dispatch adapters remain deliberate monolith seams. |
| Architecture enforcement | 5 | Python AST checks, transitive Python dependency analysis, and TypeScript import/source scans cover static, relative, aliased, dynamic, re-export, and type-only paths. |
| Extractability | 4 | Module data/UI/behavior ownership is strong; Host DI, actor context, command dispatch, and process-local ports would need adapters at extraction time, not domain rewrites. |

**Average:** 4.5 / 5.

## 6. Ready For Full Modular-Monolith Re-Audit?

**Yes, after the recorded full local gates and hosted CI are green.**

Gap 3 closes the two structural defects identified by the prior audit:
composition is explicitly host-owned, and the frontend shell no longer owns or
cycles through Contacts behavior. The next activity should be a fresh strict
modular-monolith audit, not another unscoped refactor.
