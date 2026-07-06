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
```

UOK may provide compatibility facades, shared services, shell composition, and shared database primitives. Business behavior belongs in the module package.

## Required Manifest Fields

Every module manifest must declare:

| Field | Purpose |
|---|---|
| `name` | Stable module identity matching the folder name. |
| `kind` | One of `control_module`, `capability_module`, or `business_module`. |
| `version` | Module release version. Use `APP_VERSION` when aligned with the UOK candidate version. |
| `description` | Human-readable purpose. |
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
| `tests_path` | Module test ownership directory. |
| `api_prefixes` | API route prefixes exposed or reserved by this module. |
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
| `role_grants` | Import target for module-owned role permission grants. Grants extend kernel roles without hardcoding module permissions in `src/uok/security.py`. |
| `dashboard_provider` | Import target for module-owned dashboard count fragments merged into `/api/dashboard`. |
| `evidence_provider` | Import target for module-owned baseline evidence checks and counts merged into `/api/baseline-evidence`. |
| `model_exports` | Import target for module-owned model/table exports used by migration and boundary validation while shared baseline tables remain in the kernel model registry. |
| `candidate_verifier_script` | Safe relative path under `modules/<module_name>` for this module's PowerShell candidate verifier scenario. |
| `candidate_verifier_function` | PowerShell function name invoked from `candidate_verifier_script`. |
| `candidate_evidence_function` | Optional PowerShell evidence function invoked after the module verifier scenario returns its evidence payload. |

## Extension Points

UOK currently allows these module extension surfaces:

- `manifest`: module catalog metadata and lifecycle declaration.
- `backend_package`: module-owned Python package under `modules/<module>/backend`.
- `command_handlers`: command handlers declared by manifest and dispatched by UOK.
- `api_router`: FastAPI router composition through a declared route prefix, mounted by UOK from the manifest `api_router` import target instead of hardcoded kernel imports.
- `dashboard_provider`: module-owned dashboard count fragments.
- `evidence_provider`: module-owned baseline evidence checks and counts.
- `model_exports`: module-owned model/table declarations used to validate shared baseline schema ownership.
- `permissions`: explicit permission atoms checked at API or command boundary.
- `events`: append-only events declared by manifest.
- `migrations`: module-owned migration path and release gate.
- `web_surface`: module-owned UI source or current compile-time shell registry bridge.
- `tests`: module-specific behavior tests.
- `candidate_verifier`: release verification scenarios.

New extension points require an architecture update and a failing validation test before use.

## Kernel Boundary Rules

- `src/uok` owns the kernel, shared contracts, security, command bus, module registry, API composition, static asset serving, and compatibility facades.
- `modules/<module>` owns module-specific backend implementation, UI surface, migrations, tests, commands, events, permissions, and maintenance behavior.
- Product, cargo, CRM, accounting, inventory, document, and industry-specific logic must not be embedded in the kernel.
- A module may use shared UOK database tables only when its manifest declares the table or shared-table scope it owns.
- A module must not require manual edits to unrelated modules for normal install, upgrade, disable, uninstall, or maintenance workflows.

## Current Baseline Status

- `apps.manager` is the required control module.
- `contacts.core` is the first optional capability module.
- `contacts.core` backend implementation now lives under `modules/contacts.core/backend/uok_contacts_core`.
- `contacts.core` commands, command permissions, role grants, dashboard counts, evidence checks, model exports, API router, and candidate verifier scenario are manifest-declared module surfaces.
- Contacts UI and migrations are still bridged from top-level UOK folders. Contacts behavior tests remain in top-level `tests/`, while the module candidate verifier scenario lives under `modules/contacts.core/tests/verify`. That is allowed for the current candidate only because the ownership paths are declared in the manifest and covered by tests.

## Required Scans Before GitHub Push

Before pushing a candidate to GitHub, run these gates one by one:

```powershell
python -m compileall -q src modules tests
python -m pytest -q
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
