# UOK Module Manifests and Source Boundaries

**Target:** `UOK-3.1.0-alpha.2`

This record keeps file-backed module manifests and source-boundary verification aligned with mature modular platforms such as Odoo, while preserving UOK's command/event/audit core.

The authoritative module extension rules are defined in `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`.

## Module manifest contract

Each packaged application module can now carry a local manifest file:

```text
modules/<module>/manifest.yaml
```

The `.yaml` file stores a strict dependency-light YAML subset. The runtime loader reads these files through `uok.module_manifest_loader`, and `uok.module_paths` exposes module backend packages to the local runtime.

## Loader checks

UOK verifies:

- manifest file exists;
- required identity fields are present;
- backend, web, migration, and test ownership paths are declared and module-scoped;
- API prefixes, permissions, owned tables, extension points, and data-retention policy are declared;
- product modules declare stable product identity;
- certification checks are declared;
- module names are discoverable from file-backed manifests.
- every baseline module has `backend/`, `web/`, `migrations/`, and `tests/` ownership folders.

## Source-boundary scan

The source-boundary scan checks UOK core files for product-specific tokens. The baseline gate is strict: product-specific source must stay inside installable product modules, not in the UOK core.

## Boundary rule

Product-specific commands, lifecycle rules, reports, documents, and route registration must stay outside the UOK core and inside product modules such as:

```text
modules/<product_module>/
```

The source-boundary scan must remain a strict candidate gate before any product module is promoted for local production-candidate testing.
