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
  manifest.yaml
  backend/
  web/
  migrations/
  tests/
  verify/  # required when candidate_verifier is declared
```

UOK may provide compatibility facades, shared services, shell composition, and shared database primitives. Business behavior belongs in the module package.

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
| `web_path` | Module UI ownership directory. |
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
| `role_grants` | Import target for module-owned role permission grants. Grants extend kernel roles without hardcoding module permissions in `src/uok/security.py`. |
| `dashboard_provider` | Import target for module-owned dashboard count fragments merged into `/api/dashboard`. |
| `evidence_provider` | Import target for module-owned baseline evidence checks and counts merged into `/api/baseline-evidence`. |
| `model_exports` | Import target for module-owned model/table exports used by migration and boundary validation while shared baseline tables remain in the kernel model registry. |
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
- `candidate_verifier`

Declarations such as commands, events, permissions, migrations, web ownership, and tests are required manifest metadata or assets; they are not executable extension hooks. Hook declarations are bidirectional: each listed extension requires its matching optional field or fields, and each extension-bearing field requires its registered extension. Unknown keys and extension names fail closed.

New extension points require an architecture update and a failing validation test before use.

## Runtime and Release Validation

- Runtime validation checks schema and maturity truth, lifecycle semantics, dependencies, unique ownership, safe runtime paths, backend packages, import targets, canonical non-overlapping API prefixes, permissions, and model declarations. Application composition completes this validation before importing or mounting extension providers, and only validated manifest `backend_path` roots enter Python import resolution.
- Release validation includes every runtime check, then requires module ownership folders, maturity-appropriate module tests, and safe module-owned candidate verifier files/functions.
- Runtime validation deliberately does not require `tests_path` to exist, but it still enforces the canonical `modules/<module_name>/tests` declaration. Runtime container stages exclude `modules/*/tests`; a manifest-driven container asset validator requires every runtime-proven module's exact verifier script and rejects any noncanonical test path.
- Candidate discovery consumes the canonical release validator and recursively parses each entry script's complete static dot-source closure before returning the catalog. Helpers must use a canonical literal `$PSScriptRoot` path, resolve inside the owning module `verify/` directory or the approved shared `scripts/verify` root, and remain free of links, junctions, cycles, and syntax errors. Dynamic or unresolved dot-sources fail closed, and the declared verifier must have exactly one ordinary top-level function definition across the closure before PowerShell loads any module script.

## Kernel Boundary Rules

- `src/uok` owns the kernel, shared contracts, security, command bus, module registry, API composition, static asset serving, and compatibility facades.
- `modules/<module>` owns module-specific backend implementation, UI surface, migrations, tests, runtime/release verification assets, commands, events, permissions, and maintenance behavior.
- Product, cargo, CRM, accounting, inventory, document, and industry-specific logic must not be embedded in the kernel.
- A module may use shared UOK database tables only when its manifest declares the table or shared-table scope it owns.
- A module must not require manual edits to unrelated modules for normal install, upgrade, disable, uninstall, or maintenance workflows.
- The Apps Manager HTTP adapter is module-owned under `modules/apps.manager/backend`; kernel lifecycle and persistence services remain shared and product-neutral.
- Apps Manager exposes a `module.manage`-protected reconciliation action for persisted status or manifest-snapshot drift. Reconciliation locks the organization and module record, preserves module data, updates only control-plane truth, and emits audited evidence once.

## Current Baseline Status

- `apps.manager` is the required `runtime_proven` control module and its API router is mounted only from its manifest.
- `agents.core` is an inert `planned` capability scaffold: it is not installable, updatable, maintainable, permission-bearing, or runtime-proven.
- `calendar.core`, `communications.core`, `contacts.core`, `planning.core`, and `reports.core` are optional `runtime_proven` capability modules with manifest-declared backend hooks and module-owned verifiers.
- Module backend implementations, tests, migrations, and candidate verifier assets live below their owning module roots. Module-specific React source is still composed through the top-level frontend shell for this candidate and is the next physical-ownership slice.

## Required Scans Before GitHub Push

Before pushing a candidate to GitHub, run these gates one by one:

```powershell
python -m compileall -q src modules tests
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

A module is not ready for serious expansion unless its manifest, backend package, UI ownership, migrations, tests, permissions, command/event ownership, data retention behavior, and lifecycle behavior are declared and validated.
