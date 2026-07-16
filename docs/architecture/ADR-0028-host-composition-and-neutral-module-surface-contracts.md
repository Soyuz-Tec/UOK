# ADR-0028: Host Composition And Neutral Module Surface Contracts

**Status:** Accepted
**Date:** 2026-07-16
**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK had physically module-owned backend and frontend source, but two remaining
dependency defects prevented a clean modular-monolith structure:

1. FastAPI creation, SQLAlchemy engine/session ownership, manifest provider
   resolution, ORM registration, router mounting, and other composition
   registries lived directly under `src/uok` beside shared kernel code. Feature
   modules also imported lifecycle/catalog implementation modules, and the
   `uok.models` compatibility graph made every mapped class reachable through
   one shared import.
2. The frontend module-surface contract aliased the concrete shell
   `Workbench`. The shell owned Contacts HTTP reads, state, preferences, DTOs,
   and commands while Contacts hooks imported shell implementation types. The
   resulting TypeScript graph contained shell-to-Contacts and
   Contacts-to-shell cycles.

Gap 1 and Gap 2 already established owner-only Planning data access and narrow
Planning/Contacts Python facades. This decision must preserve those boundaries,
runtime behavior, tenant scoping, authorization, and audit behavior.

## Decision

1. `src/uok/host` is the explicit composition root. It owns:
   - FastAPI application creation, lifespan, middleware/exception wiring,
     static serving, and global/module router mounting;
   - SQLAlchemy engine, bounded pool, `SessionLocal`, and request-session
     dependency;
   - validated module backend-path exposure and provider import resolution;
   - manifest-only ORM model registration;
   - command, replay-guard, role-grant, dashboard, evidence, and router
     provider composition.
2. The shared kernel keeps only stable module-neutral contracts:
   - `uok.kernel.persistence.Base` is the single declarative metadata contract;
   - `uok.kernel.module_runtime` is a framework- and ORM-independent port that
     feature modules may call for module lifecycle/catalog operations;
   - product-neutral organization, identity, governance, lifecycle, command,
     and event mappings remain in `uok.kernel_models`.
3. The host configures `ModuleRuntimePort` once during application
   composition. Feature modules may consume its module-neutral operations but
   may not import the host's lifecycle/catalog implementation, application
   factory, engine, session factory, manifest loader registries, or provider
   registries.
4. The one documented Module → Host exception is
   `from uok.host.database import get_db` in a module HTTP adapter. This is a
   FastAPI dependency-injection seam only. Feature code may not import
   `engine`, `SessionLocal`, pool configuration, or any other host symbol.
5. Module-owned mappings continue to expose their privileged manifest
   `model_exports` hooks below the owning backend. Only
   `uok.host.model_registry` resolves those hooks after static manifest
   validation. Mappings depend on `uok.kernel.persistence.Base`, never on the
   host database package.
6. The global `uok.models`, `uok.calendar_models`, and
   `uok.communication_models` compatibility import paths are retired. Callers
   use the explicit kernel mapping owner or the capability module's own private
   persistence package.
7. `web/src/contracts/moduleSurface.ts` is the neutral frontend port. It
   exposes exactly the shell capabilities a module renderer needs: token,
   current role, appearance, readonly module status rows, current busy action,
   module lifecycle action, host refresh, and unauthorized callback. It does
   not import `Workbench`, generated runtime catalogs, or feature code.
8. `web/src/generated/moduleSurfaceCatalog.ts` is the sole shell source that
   imports exact module `moduleSurface.tsx` entries. Pure navigation section
   types are generated separately in `web/src/generated/moduleSections.ts` so
   shared shell types do not depend on the runtime module catalog.
9. Contacts owns its frontend DTOs, draft/filter state, HTTP reads, preferences
   and storage keys, commands, and workspace root below
   `modules/contacts.core/web/src`. Its public UI entry renders the owner-local
   root and exports no hooks or shell-facing domain constants.
10. Architecture tests parse Python and TypeScript source, including relative,
    aliased, dynamic, re-export, and type-only imports. They reject kernel
    feature dependencies, feature-to-host/composition imports outside the exact
    `get_db` adapter allowlist, non-catalog shell-to-module imports,
    module-to-shell implementation imports, cross-owner strongly connected
    components, and Contacts domain orchestration in shell app/shared code.

## Consequences

- Application composition has one explicit owner and is no longer mixed with
  stable shared contracts.
- Manifest-only ORM registration remains deterministic and behavior-preserving,
  but ordinary code can no longer obtain every module mapping through a global
  compatibility graph.
- Feature modules depend on a small stable runtime port instead of host
  implementations. The port is process-local and must be configured by the host
  before feature operations execute; an unconfigured call fails explicitly.
- The FastAPI request-session adapter remains a narrow, documented framework
  exception. Extraction would replace that adapter with an injected unit of
  work without changing module domain behavior.
- The shell no longer owns Contacts behavior or imports Contacts internals.
  Contacts can evolve behind its exact module surface and backend public API
  without changing shell orchestration.
- The generated catalog remains compile-time composition. No browser runtime
  plugin loader, remote bundle, or microservice boundary is introduced.

## Alternatives Considered

- **Keep compatibility wrappers at the old `uok.main`, `uok.db`, and
  `uok.models` paths.** Rejected because they preserve the mixed boundary and
  keep forbidden imports viable.
- **Let feature modules continue importing lifecycle/catalog implementation
  modules.** Rejected because those modules transitively own manifest and model
  composition.
- **Move module lifecycle implementation into the kernel.** Rejected because
  persistence and manifest composition are host/platform implementation
  concerns; only the stable port belongs in the shared kernel.
- **Pass the entire `Workbench` object through a shared type alias.** Rejected
  because it makes every shell field an accidental module API and recreates
  shell-feature cycles through type-only imports.
- **Add a frontend runtime plugin loader or separate deployment.** Rejected
  because UOK remains a modular monolith with one validated build graph.

## Validation

Run the focused architecture gates:

```powershell
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
```

Then run the repository and frontend gates:

```powershell
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
```

`tests/test_kernel_host_shell_boundaries.py` is discovered by the normal Python
test runner and therefore by the existing GitHub Actions candidate-check job.
