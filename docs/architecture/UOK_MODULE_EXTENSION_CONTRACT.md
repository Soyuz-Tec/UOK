# UOK Module Extension Contract

**Status:** Mandatory UOK architecture contract

**Applies to:** all modules under `modules/<module_name>` and every future UOK capability, business, product, cargo, CRM, accounting, inventory, document, or integration module.

## Purpose

UOK is a modular monolith. Modules must be independently developable, installable, upgradable, disableable, uninstallable where allowed, testable, and maintainable without compromising UOK.

The practical rule is simple: a future module must be addable without hardcoding product or business behavior into `src/uok`.

## Required Module Shape

Each module must use this physical shape:

```text
modules/<module_name>/
  README.md
  manifest.yaml
  backend/
  web/
    src/  # executable module frontend source when web_surface is declared
  migrations/
  tests/
    web/  # module-owned TypeScript/Vitest tests
  verify/  # required when candidate_verifier is declared
```

UOK provides host composition, stable module-neutral ports, shell composition,
and shared database contracts. Business behavior belongs in the module package;
global capability compatibility facades are not an allowed ownership shortcut.

The module `README.md` is the human entry point for scope and ownership. It is enforced by the repository quality audit rather than the runtime manifest validator.

## Required Manifest Fields

Every module manifest must declare:

| Field | Purpose |
|---|---|
| `manifest_schema` | Closed manifest schema identifier. The current and only accepted value is `uok.module.v1`. |
| `name` | Stable module identity matching the folder name. |
| `kind` | One of `control_module`, `capability_module`, or `business_module`. |
| `version` | Module release version. Use `APP_VERSION` when aligned with the UOK candidate version. |
| `description` | Human-readable purpose. |
| `maturity` | Evidence-bounded state: `planned`, `source_present`, `unit_tested`, `integration_tested`, or `runtime_proven`. It never means production-ready. |
| `installable` | Whether Apps Manager can install it. |
| `uninstallable` | Whether Apps Manager can uninstall it. |
| `updatable` | Whether Apps Manager can upgrade it independently. |
| `maintainable` | Whether maintenance checks can run without compromising UOK. |
| `required` | Whether the module is required for bootstrap. Only `apps.manager` should normally be required. |
| `lifecycle` | Supported lifecycle states. |
| `commands` | Command names owned by this module. |
| `events` | Event names emitted by this module. |
| `dependencies` | Other modules required before this module can operate. |
| `backend_path` | Module backend source directory. |
| `web_path` | Module UI ownership directory. It must stay under the owning module; a declared `web_surface` requires exactly `modules/<module_name>/web`. |
| `migrations_path` | Module migration ownership directory. |
| `tests_path` | Canonical module test ownership directory. It must be exactly `modules/<module_name>/tests` so source tests can be excluded from OCI images without a second path catalog. |
| `api_prefixes` | Canonical lowercase `/api/...` route prefixes exclusively owned by this module; prefixes cannot overlap another module's route tree. |
| `permissions` | Permission atoms required by module APIs or commands. |
| `owned_tables` | Durable tables, table slices, or shared-table scopes owned by the module. |
| `extension_points` | Kernel extension points used by the module. |
| `data_retention_policy` | Data behavior when disabled, uninstalled, archived, restored, or purged. |

## Optional Manifest Fields

| Field | Purpose |
|---|---|
| `api_router` | Import target in `<package.module>:<attribute>` form for the module's FastAPI router. UOK resolves it from the module backend package at startup and mounts it; every route must stay inside the module's declared `api_prefixes`, and the module must list the `api_router` extension point. Modules without an `api_router` entry expose no module-mounted API routes. |
| `command_handlers` | Import target for a provider returning this module's command handler mapping. Every returned command must be declared in `commands`, and every declared command must have one handler. |
| `command_permissions` | Import target for a provider returning command-to-permission mappings. Every mapped command must be declared in `commands`, and every mapped permission must be declared in `permissions`. |
| `command_replay_guard` | Optional product-neutral replay-visibility callable invoked only after command type and canonical request bytes exactly match the stored succeeded command. A mismatched reuse remains the kernel's stable `409`; an exact replay may be hidden when lifecycle or retention state makes its former result unavailable. |
| `role_grants` | Import target for module-owned role permission grants. Grants extend kernel roles without hardcoding module permissions in `src/uok/kernel/security.py`. |
| `dashboard_provider` | Import target for module-owned dashboard count fragments merged into `/api/dashboard`. |
| `evidence_provider` | Import target for module-owned baseline evidence checks and counts merged into `/api/baseline-evidence`. |
| `model_exports` | Import target for a provider returning the module's exact `dict[str, mapped class]`. Registration validates direct manifest ownership, source origin, the single kernel `Base`, complete metadata, and hidden/extra mappings before schema or migration inspection. |
| `web_entry` | Canonical compile-time React entry for a declared `web_surface`. It must be exactly `modules/<module_name>/web/src/moduleSurface.tsx`, resolve inside the owning web root, and contain no linked or junction path segment. |
| `web_section` | Unique lowercase workbench section owned by a declared `web_surface`. Shell-reserved sections such as `overview`, `evidence`, and `architecture` cannot be claimed. |
| `candidate_verifier_script` | Safe relative PowerShell path under `modules/<module_name>/verify` for this module's candidate scenario. Runtime and release verification assets must not depend on `tests/` paths. |
| `candidate_verifier_function` | PowerShell function name invoked from `candidate_verifier_script`. |

## Extension Points

UOK currently allows exactly these extension hooks:

- `api_router`
- `command_handlers`
- `command_permissions`
- `command_replay_guard`
- `role_grants`
- `dashboard_provider`
- `evidence_provider`
- `model_exports`
- `web_surface`
- `candidate_verifier`

Declarations such as commands, events, permissions, migrations, and tests are required manifest metadata or assets. `web_surface` is a release/build composition extension, not a Python import hook: it pairs `web_entry` and `web_section` so the checked-in frontend catalog can be generated from validated manifests. Hook declarations are bidirectional: each listed extension requires its matching optional field or fields, and each extension-bearing field requires its registered extension. Unknown keys and extension names fail closed.

New extension points require an architecture update and a failing validation test before use.

## Runtime and Release Validation

- Runtime validation statically checks schema and maturity truth, lifecycle semantics, dependencies, unique direct ownership, explicit kernel-table scopes, safe runtime paths, backend packages, import targets, canonical non-overlapping API prefixes, permissions, and model declarations. It completes before extension imports. The host-owned model registry then imports only validated `model_exports` providers in deterministic dependency order and completes the single `uok.kernel.persistence.Base` metadata graph before migration inspection, schema creation, or other extension composition.
- Frontend/build validation includes every runtime check, then requires module frontend ownership roots plus the exact POSIX canonical entry, safe resolved path, unique non-reserved section, and paired manifest fields before catalog generation. Release validation includes the runtime and frontend checks plus all module ownership folders, maturity-appropriate module tests, and safe module-owned candidate verifier files/functions. Python runtime validation does not require TypeScript source assets to exist.
- Runtime validation deliberately does not require `tests_path` to exist, but it still enforces the canonical `modules/<module_name>/tests` declaration. Runtime container stages exclude `modules/*/tests`; a manifest-driven container asset validator requires every runtime-proven module's exact verifier script and rejects any noncanonical test path.
- Candidate discovery consumes the canonical release validator and recursively parses each entry script's complete static dot-source closure before returning the catalog. Helpers must use a canonical literal `$PSScriptRoot` path, resolve inside the owning module `verify/` directory or the approved shared `scripts/verify` root, and remain free of links, junctions, cycles, and syntax errors. Dynamic or unresolved dot-sources fail closed, and the declared verifier must have exactly one ordinary top-level function definition across the closure before PowerShell loads any module script.
- Frontend catalog generation consumes the same closed manifests, applies deterministic dependency ordering, and writes literal TypeScript imports to `web/src/generated/moduleSurfaceCatalog.ts`. The browser never reads YAML or interprets `web_entry`; Vite compiles the generated catalog and canonical entries at build time.

## Host, Kernel, And Module Boundary Rules

- `src/uok/host` owns the FastAPI application, engine/session/pool, request DI,
  manifest provider resolution, ORM registration, global middleware/static
  serving, and router/command/policy/report composition.
- `src/uok/kernel` owns only stable module-neutral contracts: the single
  declarative `Base` and the host-configured module runtime port. Product-neutral
  shared mappings remain in `src/uok/kernel_models.py`.
- `modules/<module>` owns module-specific backend implementation, ORM definitions, UI surface, migrations, tests, runtime/release verification assets, commands, events, permissions, and maintenance behavior.
- Module production frontend source and CSS live under `modules/<module>/web/src`; module frontend tests live under `modules/<module>/tests/web`. Shared shell, reusable module-neutral controls, design tokens, generated contracts, and catalog composition remain under `web/src`.
- Module surfaces depend only on `web/src/contracts/moduleSurface.ts`. The
  generated runtime catalog is the sole shell importer of exact
  `moduleSurface.tsx` entries; modules must not import shell app/features or
  concrete Workbench implementation types.
- Feature backends may use `uok.kernel.module_runtime` wrapper operations. They
  may not configure that port or import lifecycle/catalog composition
  implementations. Lifecycle mutations are restricted to the Apps Manager
  adapter; other capabilities receive read-only runtime operations.
- Module → Host production exceptions are path-and-symbol exact:
  `uok.host.database.get_db` and `uok.host.security.current_actor` in the 12
  documented HTTP adapters, plus `uok.host.commands.execute_command` in the
  Calendar, Contacts, and Planning command adapters. Engine, `SessionLocal`,
  pool, application, host registries, and every unlisted host import are
  forbidden.
- Product, cargo, CRM, accounting, inventory, document, and industry-specific logic must not be embedded in the kernel.
- A module may use shared UOK database tables only when its manifest declares the table or shared-table scope it owns.
- A module must not require manual edits to unrelated modules for normal install, upgrade, disable, uninstall, or maintenance workflows.
- The Apps Manager HTTP adapter is module-owned under `modules/apps.manager/backend`; kernel lifecycle and persistence services remain shared and product-neutral.
- Apps Manager exposes a `module.manage`-protected reconciliation action for persisted status or manifest-snapshot drift. Reconciliation locks the organization and module record, preserves module data, updates only control-plane truth, and emits audited evidence once.

## Current Baseline Status

- `apps.manager` is the required `runtime_proven` control module and its API router is mounted only from its manifest.
- `agents.core` is an inert `planned` capability scaffold: it is not installable, updatable, maintainable, permission-bearing, or runtime-proven.
- `calendar.core`, `communications.core`, `contacts.core`, `planning.core`, and `reports.core` are optional `runtime_proven` capability modules with manifest-declared backend hooks and module-owned verifiers.
- Their capability ORM mappings live in the owning backend packages and
  register beside nine product-neutral kernel mappings on one SQLAlchemy
  metadata graph. The former global ORM compatibility imports are retired.
- Apps Manager, Calendar, Communications, Contacts, and Planning declare `web_surface`; their React source, module-local CSS, entrypoints, and frontend tests live below the owning module roots and are composed through the generated compile-time catalog.
- Contacts owns its frontend DTOs, state, reads, preferences, storage keys, and
  commands. The shell passes only the neutral host port, and architecture tests
  reject every cross-owner shell/module source cycle.
- Reports owns its typed report client under `modules/reports.core/web/src` but has no workbench surface. Planning may consume that typed client without transferring Reports transport ownership into the shell.
- `agents.core` remains an inert planned scaffold and declares no executable web surface.
- The Docker frontend stage copies the module tree before Vite compilation. Vitest discovers `modules/*/tests/web`, and container validation rejects frontend tests below production `web_path` while the final image excludes canonical module test directories.

## Required Scans Before GitHub Push

Before pushing a candidate to GitHub, run these gates one by one:

```powershell
python -m compileall -q src modules tests
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/validate_container_module_assets.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Also run and review:

- source-size scan;
- module extension contract validation;
- naming and retired-name scan;
- product/cargo/source-boundary scan;
- dependency audit where tooling is available;
- local Podman rebuild and HTTP smoke verification before release handoff.

## Acceptance Rule

A module is not ready for serious expansion unless its README, manifest, backend package, UI ownership, migrations, tests, permissions, command/event ownership, data retention behavior, and lifecycle behavior are declared and validated. A module with a workbench UI must additionally declare `web_surface`, its canonical `web_entry`, and a unique `web_section`; production source, local CSS, and frontend tests must remain in the owning module paths.
