# ADR-0001: Manifest-declared module runtime boundaries

**Status:** Superseded in part by `ADR-0021-module-manifest-runtime-and-release-truth.md` and `ADR-0022-module-owned-orm-registration.md`

**Baseline:** `UOK-3.1.0-alpha.2-module-extension-baseline`

## Context

UOK already loads module API routers from `manifest.yaml`, but several Contacts-owned runtime surfaces were still wired directly in `src/uok`: command handlers, command permissions, role grants, dashboard counts, baseline evidence checks, and candidate verifier scenarios. That made the first optional module work, but it would force kernel edits for each future capability module.

## Decision

UOK resolves module-owned runtime surfaces through manifest-declared import targets and safe relative verifier script paths:

- command handler and command permission providers;
- role grant providers;
- dashboard and evidence providers;
- model export providers for shared baseline table ownership validation;
- candidate verifier scripts under `modules/<module>/tests`.

The kernel keeps shared contracts, command dispatch, security checks, API composition, baseline schema registry, static serving, and compatibility facades. Modules own their behavior and declare every extension point they use.

## Consequences

- Adding a new command-owning module should not require changes to
  `src/uok/host/commands.py`.
- Adding module permissions should not require hardcoding permission atoms in
  `src/uok/kernel/security.py`.
- Dashboard and evidence endpoints keep stable response shapes while module-specific values come from providers.
- The original shared-model bridge was closed by ADR-0022 and ADR-0028:
  capability mappings live in their owning backends, the host alone composes
  the validated registry, and global model compatibility aliases are retired.
- The candidate verifier stays top-level as a release gate, but module scenarios are discovered from manifests.

## Alternatives

- Keep hardcoded Contacts imports in the kernel. Rejected because it does not scale to additional modules.
- Load frontend and backend modules dynamically from manifests at runtime. Deferred because the current Vite bundle and Python modular monolith do not need runtime code loading to achieve the next boundary improvement.

## Validation

- Module extension contract validation checks import target shape, backend package ownership, extension point declarations, owned model resolution, and verifier script ownership.
- Unit and candidate verification must cover command dispatch, permissions, dashboard/evidence output, migration discipline, frontend build, and module verifier discovery.
