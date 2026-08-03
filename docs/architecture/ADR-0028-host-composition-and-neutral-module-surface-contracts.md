# ADR-0028: Host Composition And Neutral Module Surface Contracts

**Status:** Accepted
**Date:** 2026-07-16
**Current candidate:** `UOK-3.1.0-alpha.3`

**Amended by:** `ADR-0035-request-authoritative-frontend-async-boundary.md`

**Amended:** 2026-08-03 for compile-time-known lazy module workspaces.

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
   - `uok.kernel.security` owns the immutable `Actor` and permission-policy
     port, while the host supplies manifest role grants;
   - `uok.kernel.command_contracts` owns transport-neutral command keys,
     idempotency limits, and error envelopes;
   - product-neutral organization, identity, governance, lifecycle, command,
     and event mappings remain in `uok.kernel_models`.
3. The host configures `ModuleRuntimePort` once during application
   composition and configures the kernel security-policy port with validated
   manifest role grants. Feature modules may consume named, module-neutral
   operations but may not configure either port. Module lifecycle mutation
   wrappers are restricted to Apps Manager; other features receive read-only
   runtime queries and operational checks.
4. Module → Host exceptions are explicit path-and-symbol adapter seams:
   - `from uok.host.database import get_db` and
    `from uok.host.security import current_actor` in the 19 documented module
     HTTP adapters;
   - `from uok.host.commands import execute_command` in the exact Calendar,
     Communications, Contacts, and Planning command adapters.
   Feature code may not import `engine`, `SessionLocal`, pool configuration,
   application composition, host registries, or any other host symbol.
5. Module-owned mappings continue to expose their privileged manifest
   `model_exports` hooks below the owning backend. Only
   `uok.host.model_registry` resolves those hooks after static manifest
   validation. Mappings depend on `uok.kernel.persistence.Base`, never on the
   host database package.
6. The global `uok.models`, `uok.calendar_models`, and
   `uok.communication_models` compatibility import paths are retired. Callers
   use the explicit kernel mapping owner or the capability module's own private
   persistence package.
7. `web/src/contracts/moduleSurface.ts` remains the neutral frontend port.
   Its base host context exposes an atomic `ModuleSurfaceSession` containing
   token, monotonically increasing session generation, and a generation-bound
   unauthorized callback, plus current role, appearance, readonly module status,
   current busy action, module lifecycle action, host refresh, and monotonic
   module-refresh revision. The generated registry alone extends that base with
   `surfaceActive` for each retained surface render. The port imports no
   `Workbench`, generated runtime catalog, or feature code.
8. `web/src/generated/moduleSurfaceCatalog.ts` is the sole shell source that
   imports exact module `moduleSurface.tsx` entries. Those small entries expose
   synchronous navigation metadata and a literal, owner-local lazy workspace
   import; they never interpret a runtime path. Pure navigation section types
   are generated separately in `web/src/generated/moduleSections.ts` so shared
   shell types do not depend on the runtime module catalog.
9. Contacts owns its frontend DTOs, draft/filter state, HTTP reads, preferences
   and storage keys, commands, and workspace root below
   `modules/contacts.core/web/src`. Its public UI entry renders the owner-local
   root and exports no hooks or shell-facing domain constants.
10. The shell loads each module workspace on first activation under one
    accessible Suspense and module error boundary, then keeps only visited
    module roots mounted behind the generic `ModuleSurfaceOutlet`, preserving
    owner-local unsaved state. The registry reports each retained root's exact
    active state. Global refresh increments the neutral revision. ADR-0035 requires
    shell and owner-local async effects to use monotonic request authority so
    stale completions and stale unauthorized responses cannot affect a newer
    session or owner state.
11. Architecture tests use Python AST import analysis plus a TypeScript
    import/source scanner covering relative, aliased, dynamic, re-export, and
    type-only imports. They reject kernel feature dependencies, direct or
    transitive feature-to-host dependencies outside the exact adapter
    allowlist, non-Apps-Manager lifecycle mutation imports, non-catalog
    shell-to-module imports, module-to-shell implementation imports,
    cross-owner strongly connected components, and Contacts domain
    orchestration in shell app/shared code.

The first post-freeze Product Master slice adds one compliant HTTP adapter at
`modules/product.master/backend/uok_product_master/_internal/delivery/api.py`.
Only `get_db` and `current_actor` are allowlisted there, increasing the exact
in-process Host adapter surface from 27 to 29 imports without changing this
decision or adding a Kernel/shell dependency.

The subsequent Location Master slice adds the same bounded adapter shape at
`modules/locations.core/backend/uok_locations_core/_internal/delivery/api.py`.
Its exact `get_db` and `current_actor` imports increase the adapter surface from
29 to 31 without widening Host responsibilities, Kernel contracts, existing
module facades, or the neutral shell surface.

The Route/Corridor Master slice adds the same bounded adapter shape at
`modules/routes.core/backend/uok_routes_core/_internal/delivery/api.py`. Its
exact `get_db` and `current_actor` imports increase the adapter surface from 31
to 33. Route business behavior remains owner-local, while its only feature
dependency uses named immutable `uok_locations_core.public_api` symbols.

The Shipment Support slice adds the same bounded adapter shape at
`modules/shipments.core/backend/uok_shipments_core/_internal/delivery/api.py`.
Its exact `get_db` and `current_actor` imports increase the adapter surface from
33 to 35. Shipment business behavior remains owner-local; Party, Location, and
Route data are consumed only through named immutable owner-facade symbols. The
Route path facade extension is value-only and owner-authorized, and the
existing Planning typed-link resolver consumes only the immutable Shipment
reference facade.

The Compliance Document Type slice adds the same bounded adapter shape at
`modules/compliance.core/backend/uok_compliance_core/_internal/delivery/api.py`.
Its exact `get_db` and `current_actor` imports increase the adapter surface from
35 to 37. Compliance behavior, mappings, lifecycle, UI, and verification remain
owner-local; the module has no feature dependency and exposes only immutable
value data through its public facade.

The Shipment Readiness slice adds the same bounded adapter shape at
`modules/intelligence.core/backend/uok_intelligence_core/_internal/delivery/api.py`.
Its exact `get_db` and `current_actor` imports increase the adapter surface from
37 to 39 across 18 HTTP adapters. `intelligence.core` is stateless and depends
only on the frozen `ShipmentReadinessSnapshotDTO` and
`resolve_shipment_readiness_snapshots` symbols in the Shipment public facade.
It adds no ORM mapping, table, SQL migration, command, event, Kernel contract,
Host business logic, shell field, or reverse Shipment dependency. Its
module-owned workbench is composed through the existing neutral surface
contract. This is a bounded capability addition under the active architecture
freeze, not an architecture unfreeze.

The Communications retained-lifecycle slice adds one exact
`execute_command` import in its existing HTTP adapter, increasing the
allowlisted Host adapter surface from 39 to 40 imports across 18 HTTP adapters
and four command adapters. It adds no Host database/session/configuration
access and does not widen Communications domain ownership.

The Contacts retained-lifecycle slice keeps lifecycle payload/header mapping
host-free and splits four thin routes into the exact
`api_system_lifecycle_routes.py` HTTP adapter so the existing system adapter
stays below the hard source-size limit. Its exact `get_db` and `current_actor`
imports increase the allowlisted surface from 40 to 42 imports across 19 HTTP
adapters and four command adapters. Command dispatch remains behind the
existing Contacts command adapter.

## Consequences

- Application composition has one explicit owner and is no longer mixed with
  stable shared contracts.
- Manifest-only ORM registration remains deterministic and behavior-preserving,
  but ordinary code can no longer obtain every module mapping through a global
  compatibility graph.
- Feature modules depend on small stable runtime, security, and command
  contracts instead of host implementations. Process-local ports must be
  configured by the host before feature operations execute; unconfigured calls
  fail explicitly.
- FastAPI request-session/auth dependencies and command dispatch remain narrow,
  documented adapter exceptions. Extraction would replace those adapters with
  an injected unit of work, actor context, and command bus without changing
  module domain behavior.
- The shell no longer owns Contacts behavior or imports Contacts internals.
  Contacts can evolve behind its exact module surface and backend public API
  without changing shell orchestration. Visited module roots retain unsaved
  owner-local state, global refresh reaches owner-local reads, and a module 401
  clears host-scoped data before another tenant can sign in.
- The generated catalog remains compile-time composition. Literal local dynamic
  imports create static Vite chunks; no browser runtime plugin loader, remote
  bundle, or microservice boundary is introduced.

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
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
```

Then run the repository and frontend gates:

```powershell
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
```

`tests/test_kernel_host_backend_boundaries.py` and
`tests/test_kernel_host_shell_boundaries.py` are discovered by the normal
Python test runner and therefore by the existing GitHub Actions
candidate-check job.
