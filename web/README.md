# UOK Frontend Shell

**Status:** Active frontend ownership guide.

**Current candidate:** `UOK-3.1.0-alpha.3`

The root `web` package owns the product-neutral React + TypeScript + Vite workbench shell. It is one dependency and build graph that compiles both shell source and validated module-owned frontend entries.

## Shell Ownership

- `web/src/app` owns shell orchestration and navigation.
- `web/src/shared` owns reusable module-neutral controls, data helpers, design primitives, and export helpers.
- `web/src/features/modules` owns the typed module-surface contract and registry adapter.
- `web/src/generated` contains generated contracts and the manifest-derived module surface catalog; generated files are never edited manually.
- `web/e2e` owns cross-workbench browser proof.

Module-specific React source and CSS live under `modules/<module_name>/web/src`; module frontend tests live under `modules/<module_name>/tests/web`. A module surface is compiled only after its closed manifest declares and passes validation for `web_surface`, its canonical `web_entry`, and a unique `web_section`.

The browser never reads YAML, resolves manifest paths, or loads remote module code. The generator emits literal imports into `web/src/generated/moduleSurfaceCatalog.ts`, and Vite builds those entries into the normal static bundle.

## Verify

From the repository root:

```powershell
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
```

Use the standard UOK `Verify` operation before publication. Runtime UI changes also require the local workbench and Playwright proof.
