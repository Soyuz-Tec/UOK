# UOK Module Manifests and Source Boundaries

**Target:** `UOK-3.1.0-alpha.3`

This record keeps file-backed module manifests and source-boundary verification aligned with mature modular platforms such as Odoo, while preserving UOK's command/event/audit core.

The architecture entry point is `docs/ARCHITECTURE.md`. The authoritative module extension rules are defined in `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`.

## Module manifest contract

Each packaged application module can now carry a local manifest file:

```text
modules/<module>/manifest.yaml
```

The `.yaml` file stores the closed `uok.module.v1` dependency-light YAML subset. Every manifest declares an evidence-bounded maturity value. The runtime loader reads these files through `uok.module_manifest_loader`, and `uok.module_paths` exposes module backend packages to the local runtime.

`contacts.core` currently declares these runtime surfaces from its manifest:

- `api_router`
- `command_handlers`
- `command_permissions`
- `role_grants`
- `dashboard_provider`
- `evidence_provider`
- `model_exports`
- `candidate_verifier_script`

`agents.core` currently declares a scaffold boundary only. Its maturity is `planned`; its lifecycle is only `planned`; and its install, update, uninstall, maintenance, permission, API, command, event, model, and extension claims are intentionally empty until the first behavior increment is implemented.

## Loader checks

UOK verifies:

- manifest file exists and uses `manifest_schema: uok.module.v1`;
- required identity and maturity fields are present with exact scalar/list/boolean types;
- duplicate/unknown keys, duplicate list values, unknown maturity values, and unknown extension hooks fail closed;
- backend, web, migration, and test ownership paths are declared and module-scoped;
- API prefixes, permissions, owned tables, extension points, and data-retention policy are declared;
- optional `api_router` import targets resolve from the module backend package, require the `api_router` extension point, and stay inside declared API prefixes;
- optional Python extension import targets resolve from the module backend package and require their matching extension point;
- command handler and command permission providers cover every declared command and only use declared permissions;
- role grants only use permissions declared by the module;
- dashboard and evidence providers return validated mapping fragments;
- direct model ownership declarations are unique and require a `model_exports` provider, while kernel table use requires an explicit shared-table scope;
- after static validation, model providers register in deterministic dependency order and must return the exact manifest-owned mapped classes from the owning backend on the single kernel `Base`;
- module-declared PowerShell candidate verifier scripts stay under `modules/<module_name>/verify` and are release assets independent of `tests/`;
- module names are discoverable from file-backed manifests;
- every baseline module has `backend/`, `web/`, `migrations/`, and `tests/` ownership folders.

Runtime validation runs before manifest router mounting and does not require development test folders. Release validation adds every source ownership folder, maturity-appropriate module tests, and candidate verifier assets. Local/CI release gates call `validate_module_release_contracts`; runtime and container startup call `validate_module_runtime_contracts`.

Planning and Contacts additionally enforce one supported Python facade per
module. Runtime router, command, policy, dashboard, evidence, and Planning replay
hooks resolve through `public_api`; implementation packages live below
`_internal`. The sole exception is the privileged `model_exports` bootstrap
hook, which stays manifest-resolved under `_internal.persistence` and is never a
business API. `tests/test_module_public_api_boundaries.py` rejects external
Python implementation imports, unsupported facade symbols, dynamic literal
deep imports, and external frontend imports other than `moduleSurface`.

## Source-boundary scan

The source-boundary scan checks UOK core files for product-specific tokens. The baseline gate is strict: product-specific source must stay inside installable product modules, not in the UOK core.

## Boundary rule

Product-specific commands, lifecycle rules, reports, documents, candidate scenarios, dashboard/evidence fragments, and route registration must stay outside the UOK core and inside product modules such as:

```text
modules/<business_module>/
```

The source-boundary scan must remain a strict candidate gate before any product module is promoted for local production-candidate testing.

## Current Bridge Status

The former ORM bridge is closed: 29 capability mappings are physically owned by
Calendar, Communications, Contacts, Planning, and Reports backends, while nine
product-neutral mappings remain in `uok.kernel_models`. `uok.models` is an
exact-class compatibility facade over the validated registry.

The former frontend-location bridge is also closed. Apps Manager, Calendar,
Communications, Contacts, and Planning own production React source and CSS under
their canonical module web roots; their frontend tests live under
`modules/<module_name>/tests/web`. Reports owns its typed report client and tests without
declaring a workbench surface. Closed manifest metadata generates literal
compile-time imports for the shell registry, and the browser never interprets
YAML or dynamic module paths.

One intentional compatibility bridge remains: the typed Workbench surface host
passes existing shell state and commands into module renderers. It preserves
current orchestration during relocation but is not a destination for new
module-specific behavior. Module-owned ORM definitions, migrations, production
UI, behavior tests, and verifier assets are active baseline requirements.
