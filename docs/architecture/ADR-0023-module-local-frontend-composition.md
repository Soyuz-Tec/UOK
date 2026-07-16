# ADR-0023: Module-Local Frontend Composition

**Status:** Accepted; shell contract amended by ADR-0028
**Date:** 2026-07-10
**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK manifests already declared a `web_path`, but the executable Apps Manager,
Calendar, Communications, Contacts, and Planning React source, tests, and CSS
were physically stored below the shared `web/src` tree. The shell also imported
those module workspaces through a manually maintained registry. This made
manifest ownership descriptive, allowed the registry to drift from the closed
module catalog, and left container and test discovery dependent on the shell's
folder layout.

Moving source below module roots must not turn manifests into browser runtime
configuration or allow arbitrary dynamic imports. The Vite bundle still needs
all executable entries to be known and type-checked at build time, while the
Python service remains the scheduling authority.

## Decision

1. Executable module frontend source lives under
   `modules/<module_name>/web/src`. Each workbench-owning module exposes the
   canonical entry `modules/<module_name>/web/src/moduleSurface.tsx`, and its
   module-specific CSS is imported from that module-local entry.
2. Module frontend tests live under `modules/<module_name>/tests/web`. Vitest
   discovers those tests together with shell and shared tests under `web/src`.
3. The closed `uok.module.v1` manifest contract adds the compile-time
   `web_surface` extension with paired `web_entry` and `web_section` fields.
   The entry must use the canonical module-local path; the section must be
   unique, lowercase, and outside shell-reserved sections.
4. `scripts/generate_frontend_module_catalog.py` validates the closed manifest
   catalog, orders surfaces deterministically by module dependencies, and emits
   checked-in literal TypeScript imports in
   `web/src/generated/moduleSurfaceCatalog.ts`. Generated-contract drift
   checking fails when manifests and the catalog disagree.
5. The browser never reads manifest YAML, resolves a manifest path, or loads a
   module dynamically. Manifest metadata influences the frontend only through
   the generated compile-time catalog and the statically compiled Vite bundle.
6. `web/src` remains the shell, shared UI/control, generated contract, and
   composition layer. The generated catalog feeds one typed module-surface
   registry; it is the only shell source allowed to import exact module surface
   entries.
7. ADR-0028 replaces the former `Workbench` compatibility alias with the
   dependency-free `web/src/contracts/moduleSurface.ts` port. The shell passes
   only token, role, appearance, readonly module status, busy action, lifecycle
   action, refresh, and unauthorized callback. Contacts owns its data fetching,
   preferences, storage keys, DTOs, options, state, and commands.
8. Apps Manager, Calendar, Communications, Contacts, and Planning declare
   `web_surface`. Reports owns its typed report HTTP client under
   `modules/reports.core/web/src` but does not declare a workbench surface.
   `agents.core` remains an inert planned scaffold with no executable frontend
   entry or `web_surface` declaration.
   Planning consumes that client as an optional frontend integration rather
   than a hard lifecycle dependency; export controls fail closed when Reports
   is unavailable while Planning scheduling and reads remain operational.
9. TypeScript, Vite, and Vitest include the module-owned source and test roots.
   The frontend container build copies `modules/` before compilation, while the
   final runtime image keeps module production source and excludes canonical
   module test directories. Container asset validation rejects frontend tests
   placed below a module's production `web_path`.
10. Python module service first, with React UI receiving validated schedule read models.

## Consequences

- Physical ownership now matches manifest ownership for feature components,
  feature tests, module-local styles, surface entrypoints, the Reports HTTP
  client, and Contacts frontend orchestration/data/contracts.
- Adding or removing a workbench surface requires one closed manifest change,
  its canonical TypeScript entry, regenerated catalog output, and tests; a
  forgotten manual shell import cannot silently define catalog truth.
- Module-local CSS loads only when its statically imported module entry is part
  of the bundle. Product-neutral tokens, shell layout, and reusable controls
  stay in `web/src`.
- Cross-module client reuse is visible in TypeScript imports. In particular,
  Planning uses the Reports-owned client as an availability-gated optional
  integration without moving report transport code into shared shell utilities,
  changing Python scheduling authority, or blocking Planning during a Reports
  provider outage.
- Development and OCI builds need the repository-level `modules/` tree in the
  Vite filesystem boundary; a web-only directory copy is no longer sufficient.
- Architecture tests reject module-to-shell implementation imports,
  shell-to-module imports outside the generated catalog, Contacts domain
  orchestration in shell code, and cross-owner source cycles.

## Alternatives Considered

- **Keep module UI below `web/src/features`.** Rejected because manifest
  ownership would remain descriptive and module tests/styles would continue to
  depend on a shell-owned physical layout.
- **Load YAML or manifest-provided paths in the browser.** Rejected because it
  creates an unsafe runtime code-loading boundary, bypasses normal TypeScript
  compilation, and makes CSP, packaging, and deterministic review harder.
- **Use Vite glob discovery without a generated catalog.** Rejected because
  filesystem discovery would become a second module catalog that can disagree
  with validated manifests and dependency order.
- **Publish separate runtime-loaded module bundles now.** Rejected because UOK
  is a modular monolith and does not yet need a frontend plugin loader, remote
  bundle trust model, or independent browser deployment lifecycle.
- **Move shared shell and design-system code into every module.** Rejected
  because it duplicates module-neutral behavior and weakens consistent UI,
  accessibility, and dependency governance.

## Validation

- Manifest contract tests cover exact POSIX canonical entries, reserved and
  duplicate sections, missing build entries, runtime/build asset separation,
  paired extension fields, and inert planned modules.
- Frontend catalog tests cover manifest-driven inclusion, omission of headless
  modules, dependency ordering, deterministic output, and checked-in drift.
- Registry tests cover manifest-to-surface identity, unique module and section
  ownership, and stable presentation ordering.
- TypeScript and production Vite builds compile module-owned source through the
  repository-level aliases; Vitest discovers module-owned frontend tests.
- Container validation proves production source is available to the web build,
  module tests remain outside production `web_path`, and the final runtime image
  excludes canonical module test directories.
- The full candidate verifier and live browser proof remain the release evidence
  for unchanged module behavior after relocation.
