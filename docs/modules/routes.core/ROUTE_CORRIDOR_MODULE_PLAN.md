# Route/Corridor Module Plan

**Module:** `routes.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/routes.core`

## Purpose And Authority

`routes.core` is the optional, governed Route/Corridor master-data owner. It defines stable tenant-scoped route identity and an ordered path over Location Master IDs without owning Locations, Parties, Products, Planning schedules, Shipments, carriers, tracking, optimization, maps, or intelligence.

Location identity remains in `locations.core`. Route consumes only the frozen `LocationReferenceResolution` and `resolve_location_references` symbols from `uok_locations_core.public_api`; Route tables never join or foreign-key Location tables.

Detailed design and delivery evidence:

- `docs/delivery/route-corridor-slice-design-2026-07-16.md`
- `docs/delivery/route-corridor-slice-delivery-2026-07-16.md`

## First Slice

The 2026-07-16 slice owns:

- organization-unique immutable route codes and canonical route names;
- optional `sea`, `road`, `rail`, `air`, or `multimodal` mode hints;
- ordered paths with one origin, zero to eight waypoints, and one destination;
- stable Location IDs resolved through the Location owner facade;
- governed create, update, archive, and restore commands with optimistic versions;
- append-only canonical-name history plus normal command/event evidence;
- organization-scoped list, detail, Location-option, reference-resolution, and history reads;
- a module-owned Route/Corridor Master workbench;
- module lifecycle, candidate verification, and Route-to-Location boundary enforcement.

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/routes.core/manifest.yaml` |
| Backend behavior and private ORM | `modules/routes.core/backend/uok_routes_core` |
| Schema changes | `modules/routes.core/migrations` |
| Backend and frontend tests | `modules/routes.core/tests` |
| Candidate verifier | `modules/routes.core/verify` |
| Production React and CSS | `modules/routes.core/web/src` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The Route facade is narrow and exports only immutable reference data plus runtime-composition providers. In addition to the original `RouteReferenceDTO` identity resolver, the real Shipment caller consumes frozen `RoutePathReferenceDTO` values through `resolve_route_path_references`. The eight-symbol facade exposes no Route or Stop ORM object, mutable collection, or owner service. ORM mappings, services, request schemas, Location integration details, and mutable entities remain private.

## Data And Integrity Rules

- Every Route Definition and child row belongs to exactly one organization.
- Codes are normalized, immutable, and unique only within one organization.
- Each route has 2–10 unique ordered Location IDs: origin, optional waypoints, destination.
- A Location ID is accepted for create/path update only when `locations.core` resolves it as active and visible to the same actor and tenant.
- Route persists no Location code, name, type, country, ORM object, or foreign key.
- Existing routes remain readable when a Location is later archived or missing; the owner resolution status is shown explicitly.
- Canonical-name changes append history rather than silently replacing evidence.
- Updates, archive, and restore require the current version and increment it on success.
- Archive is recoverable; this slice provides no purge or hard delete.
- All reads and mutations enforce authenticated actor organization, permission, and module-operational scope.

## Public And UI Contracts

- Read API: `/api/routes/definitions`
- Detail API: `/api/routes/definitions/{route_definition_id}`
- Name history API: `/api/routes/definitions/{route_definition_id}/name-history`
- Route-owned Location choices: `/api/routes/location-options`
- Commands: `CreateRouteDefinition`, `UpdateRouteDefinition`, `ArchiveRouteDefinition`, `RestoreRouteDefinition`
- Permissions: `routes.read`, `routes.manage`
- Workbench section: `routes`

The workbench uses the existing neutral module-surface host contract. All Route DTOs, HTTP calls, command payloads, state, components, and CSS remain module-owned.

## Non-Goals

- Shipment execution, booking, carrier workflow, real-time tracking, schedules, rates, capacity, route optimization, distance, duration, maps, GIS, coordinates, or intelligence scoring.
- Party/Product/Planning integration, Planning provider activation, cross-module table access, or copied Location master data. Shipment integration is limited to the immutable Route path-reference query contract.
- Separate Corridor/Leg aggregates, route variants, circular routes, bulk import/export, path-version restore, hard delete, or global route catalogs.
- Kernel contracts, Host business logic, shell contract changes, module splits, microservices, or runtime module loading.

## Qualification

Before promotion:

```powershell
python -m pytest -q -p no:cacheprovider modules/routes.core/tests --ignore=modules/routes.core/tests/web
python -m pytest -q -p no:cacheprovider tests/test_route_location_data_boundary.py tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Runtime changes additionally require a rebuilt local PostgreSQL candidate, authenticated Route verifier evidence, browser proof for the complete ordered-path workflow, a healthy `/health` response, GitHub preflight/readiness, and green hosted CI.

## Next Slice Boundary

The thin Shipment Support owner now references Route paths through
`RoutePathReferenceDTO` and `resolve_route_path_references`; it owns Shipment
state and never joins Route or Location tables. Future Route changes must keep
that immutable query contract backward compatible or follow the architecture
freeze exception process. A tenant-scoped Compliance Document Type remains
safer than speculative optimization, carrier, tracking, or Intelligence
behavior.
