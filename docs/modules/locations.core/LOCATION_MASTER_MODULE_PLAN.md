# Location Master Module Plan

**Module:** `locations.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/locations.core`

## Purpose And Authority

`locations.core` is the optional, governed Location master-data owner. It defines stable tenant-scoped identity and lifecycle for operational ports, warehouses, cities, and regions without owning Party addresses, Products, routes, shipments, inventory, maps, coordinates, or global geographic catalogs.

The module name follows the provider boundary already reserved by Planning. Planning's `location.provider` remains inactive. `routes.core` is the first real cross-module consumer and `shipments.core` is the second; both use only the frozen `LocationReferenceResolution` plus the owner-authorized `resolve_location_references` batch facade. No consumer may use Location ORM mappings or tables.

## First Slice

The 2026-07-16 slice owns:

- organization-unique immutable location codes;
- canonical names;
- controlled `port`, `warehouse`, `city`, and `region` types;
- two-letter normalized country identifiers;
- create, governed update, archive, and restore commands;
- optimistic version checks for mutation safety;
- append-only canonical-name history;
- organization-scoped list, detail, and history reads;
- actor-authorized immutable Location reference resolution for the Route/Corridor and Shipment owners;
- command/event audit correlation;
- a module-owned Location Master workbench;
- module lifecycle, candidate verification, and architecture-boundary evidence.

Detailed design and delivery evidence:

- `docs/delivery/location-master-slice-design-2026-07-16.md`
- `docs/delivery/location-master-slice-delivery-2026-07-16.md`

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/locations.core/manifest.yaml` |
| Backend behavior and private ORM | `modules/locations.core/backend/uok_locations_core` |
| Schema changes | `modules/locations.core/migrations` |
| Backend and frontend tests | `modules/locations.core/tests` |
| Candidate verifier | `modules/locations.core/verify` |
| Production React and CSS | `modules/locations.core/web/src` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The module facade is limited to four runtime-composition providers plus the frozen `LocationReferenceResolution` and `resolve_location_references` query used by `routes.core` and `shipments.core`. ORM mappings and implementation packages remain private. Any later caller or contract growth requires the same real-caller and freeze review.

## Data And Integrity Rules

- Every Location Definition belongs to exactly one organization.
- Location codes are normalized and unique only within that organization; another tenant may reuse the same code.
- Codes are immutable after creation.
- Canonical-name changes append history rather than silently replacing evidence.
- Updates, archive, and restore require the current version and increment it on success.
- Archive is recoverable; this slice provides no purge or hard delete.
- All reads and mutations enforce authenticated actor organization and permission scope.
- Country identifiers are syntactic two-letter codes, not references to a shared Country table.
- Feature foreign keys, cross-module joins, foreign ORM imports, raw foreign-table access, and shared Location tables are forbidden.

## Public And UI Contracts

- Read API: `/api/locations/definitions`
- Detail API: `/api/locations/definitions/{location_definition_id}`
- Name history API: `/api/locations/definitions/{location_definition_id}/name-history`
- Commands: `CreateLocationDefinition`, `UpdateLocationDefinition`, `ArchiveLocationDefinition`, `RestoreLocationDefinition`
- Permissions: `locations.read`, `locations.manage`
- Workbench section: `locations`
- Owner DTO query: `LocationReferenceResolution` and `resolve_location_references`

The UI uses the existing neutral module-surface host contract. All Location DTOs, HTTP calls, command payloads, state, components, and CSS remain module-owned.

## Non-Goals

- Route/Corridor topology, route optimization, multi-leg shipment planning, schedules, distance, or transit-time behavior.
- Planning resolver activation, Planning facade changes, or Planning table access.
- Party-address migration, Product links, shipment links, global Country data, maps, GIS, geocoding, coordinates, warehouse capacity, inventory, aliases, dedupe, merge, bulk import/export, or hard-coded location catalogs.
- Kernel contracts, Host business logic, shell contract changes, module splits, microservices, or runtime module loading.

## Qualification

Before promotion:

```powershell
python -m pytest -q -p no:cacheprovider modules/locations.core/tests --ignore=modules/locations.core/tests/web
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate_isolated.ps1
```

Runtime changes additionally require a rebuilt local PostgreSQL candidate, authenticated Location Master verifier evidence, and a healthy `/health` response.

## Next Slice Boundary

The Route/Corridor owner is the first bounded consumer of the immutable Location query contract, and Shipment Support is the second. Shipment stores only stable origin/destination IDs and calls the same unchanged facade; Location topology and movement logic remain outside Location Master. Every later consumer or contract addition still requires a real caller and freeze review.
