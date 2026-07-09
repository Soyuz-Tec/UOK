# UOK Module Manifests and Source Boundaries

**Target:** `UOK-3.1.0-alpha.3`

This record keeps file-backed module manifests and source-boundary verification aligned with mature modular platforms such as Odoo, while preserving UOK's command/event/audit core.

The architecture entry point is `docs/ARCHITECTURE.md`. The authoritative module extension rules are defined in `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`.

## Module manifest contract

Each packaged application module can now carry a local manifest file:

```text
modules/<module>/manifest.yaml
```

The `.yaml` file stores a strict dependency-light YAML subset. The runtime loader reads these files through `uok.module_manifest_loader`, and `uok.module_paths` exposes module backend packages to the local runtime.

`contacts.core` currently declares these runtime surfaces from its manifest:

- `api_router`
- `command_handlers`
- `command_permissions`
- `role_grants`
- `dashboard_provider`
- `evidence_provider`
- `model_exports`
- `candidate_verifier_script`

`agents.core` currently declares a scaffold boundary only. It has ownership folders, permissions, lifecycle metadata, and a data-retention policy, but no runtime API, command handlers, migrations, or candidate verifier until the first behavior increment is implemented.

## Loader checks

UOK verifies:

- manifest file exists;
- required identity fields are present;
- backend, web, migration, and test ownership paths are declared and module-scoped;
- API prefixes, permissions, owned tables, extension points, and data-retention policy are declared;
- optional `api_router` import targets resolve from the module backend package, require the `api_router` extension point, and stay inside declared API prefixes;
- optional Python extension import targets resolve from the module backend package and require their matching extension point;
- command handler and command permission providers cover every declared command and only use declared permissions;
- role grants only use permissions declared by the module;
- dashboard and evidence providers return validated mapping fragments;
- model ownership declarations resolve against the baseline SQLAlchemy model registry;
- module-declared PowerShell candidate verifier scripts stay under `modules/<module_name>`;
- module names are discoverable from file-backed manifests;
- every baseline module has `backend/`, `web/`, `migrations/`, and `tests/` ownership folders.

## Source-boundary scan

The source-boundary scan checks UOK core files for product-specific tokens. The baseline gate is strict: product-specific source must stay inside installable product modules, not in the UOK core.

## Boundary rule

Product-specific commands, lifecycle rules, reports, documents, candidate scenarios, dashboard/evidence fragments, and route registration must stay outside the UOK core and inside product modules such as:

```text
modules/<business_module>/
```

The source-boundary scan must remain a strict candidate gate before any product module is promoted for local production-candidate testing.

## Current bridge status

This candidate still has two intentional bridges:

- module-specific React source is composed through `web/src/features/modules/moduleSurfaceRegistry.tsx` and feature folders under `web/src/features`;
- Contacts pytest behavior tests and the module candidate verifier scenario now live under `modules/contacts.core/tests`.

Future module expansion should move more module-owned UI behind module roots without weakening the shared shell and runtime boundaries. Module-owned migrations and behavior tests are now active baseline requirements.
