# Route/Corridor Master Slice Design – 2026-07-16

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Evidence

No Route, Corridor, route-leg, or waypoint owner currently exists under `modules/`. The enforced model inventory in `tests/fixtures/module_model_registry.json`, the module manifests, and the release contract contain no Route/Corridor mappings, tables, commands, events, permissions, API prefix, or UI surface.

Existing path-like concepts are not trade-route master data:

- `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` reserves a typed `location` reference owned by `locations.core`, but Planning's Location provider is unavailable and this slice does not activate it.
- `modules/planning.core/backend/uok_planning_core/_internal/persistence/planning_resource_models.py` can store a generic stable Location target ID for a Planning resource; it does not own Location or Route topology.
- `modules/planning.core/web/src/planningDependencyGeometry.ts` draws Gantt dependency paths only. It is unrelated to trade corridors.
- `modules/locations.core` owns the completed Location Master: `location_definitions` and `location_name_history`, the `/api/locations` API, four lifecycle commands, a module-owned workbench, and a candidate verifier.
- `modules/locations.core/backend/uok_locations_core/public_api.py` currently exposes exactly four runtime-composition hooks and no cross-module Location DTO/query. `docs/modules/locations.core/LOCATION_MASTER_MODULE_PLAN.md` deliberately reserves the first immutable Location query contract for a real Route/Corridor consumer.
- `docs/delivery/location-master-slice-delivery-2026-07-16.md` identifies a small tenant-scoped Route/Corridor Definition owner as the next evidence-backed slice and forbids Location-table joins or foreign keys.

## 2. Gap After Location Master

Operations can now maintain stable tenant-owned ports, warehouses, cities, and regions, but they cannot define a reusable ordered corridor such as an RCN origin warehouse or port, one or more transit waypoints, and a destination port. Planning's typed links cannot replace an authoritative Route aggregate, and Location must not absorb topology or movement logic.

The smallest demoable gap is therefore a governed Route Definition registry that stores only stable Location IDs, resolves them through the Location owner's immutable API, and gives operators lifecycle-safe list, detail, create, edit, archive, restore, and name-history workflows. It does not execute shipments or calculate a route.

## 3. Domain Model

### Route Definition

`RouteDefinition` is the tenant-owned aggregate root:

| Field | Rule |
|---|---|
| `id` | Stable internal UUID-style identifier |
| `organization_id` | Mandatory tenant key; never accepted from request payloads |
| `code` | Normalized uppercase/hyphenated, immutable, unique within one organization |
| `canonical_name` | Required operational name, mutable with append-only name history |
| `mode_hint` | Optional controlled value: `sea`, `road`, `rail`, `air`, or `multimodal`; descriptive only |
| `status` | `active` or recoverable `archived` |
| `version` | Positive optimistic-concurrency version |
| actor/timestamps | Creator, last updater, create/update time, optional archive time |

### Ordered Route Stops

`RouteStop` is an owned child row, not a Location copy:

- each active definition has 2–10 ordered stops;
- sequence `0` is `origin`, the final sequence is `destination`, and any intermediate rows are `waypoint`;
- a route supports zero to eight waypoints;
- every stop stores only `location_definition_id` plus owner-local route/tenant/sequence/role fields;
- origin and destination must differ, and one Location cannot appear twice in this first slice;
- every referenced Location must resolve in the actor's tenant and be active when a route is created or its path is changed;
- existing route reads may display a Location that was later archived as unavailable without copying its authoritative code/name into Route tables.

Ordered stops are the persisted topology. Consecutive pairs are the implied legs; this slice does not persist a second leg aggregate.

### History And Audit

`RouteNameHistory` records actual canonical-name changes with previous name, new name, reason, actor, and timestamp. Normal UOK command/event evidence records create, update, archive, and restore operations. Route create/update event payloads include the ordered stable Location IDs so path changes remain auditable without adding a speculative path-version subsystem.

## 4. Owning Module And Justification

Create `modules/routes.core` as one optional `capability_module` with the canonical backend, web, migrations, tests, and verifier folders.

This is a justified new module rather than an expansion of `locations.core` because Route topology has its own aggregate, three owned tables, lifecycle, permission set, commands/events, public contract, UI, and verifier. Location remains canonical place identity and can evolve independently. Route is also not Planning: no project/task/schedule transaction is required to define a corridor.

The module declares `dependencies: [locations.core]`, API prefix `/api/routes`, workbench section `routes`, permissions `routes.read` and `routes.manage`, and normal manifest-driven composition. It adds no Kernel contract or Host business logic.

## 5. Minimal Public API Symbols

### Location owner facade extension

Add exactly two supported symbols to `uok_locations_core.public_api` for the real `routes.core` caller:

1. `LocationReferenceResolution` — frozen dataclass containing only requested `location_definition_id`, resolution `status` (`ready`, `unavailable`, `denied`, or `missing`), optional code/name/type/country value data, and a status summary.
2. `resolve_location_references(db, actor, location_definition_ids=None)` — owner-authorized, tenant-scoped batch resolver. With IDs it preserves requested order and explicitly represents missing or later-archived targets; without IDs it returns the active `ready` choices required by the Route editor.

The call requires `locations.read`, verifies `locations.core` is operational, and returns no ORM object, SQLAlchemy expression, repository, session factory, or tenant identifier.

### Route owner facade

`uok_routes_core.public_api` exposes only:

1. `RouteReferenceDTO` — immutable, serialization-safe route reference data for approved future owner callers.
2. `resolve_route_reference` — tenant/permission/lifecycle-aware stable-ID resolver with no ORM leakage.
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

The Route resolver is intentionally reference-sized; list/detail/path editing remain in the owner HTTP API. Adding a later Shipment or Planning command/query contract requires a real caller and the normal freeze review.

## 6. Location Consumption

`routes.core` imports only named symbols from `uok_locations_core.public_api`:

```python
from uok_locations_core.public_api import LocationReferenceResolution, resolve_location_references
```

Create/update command services pass the authenticated `Actor` and current `Session` to the batch resolver, require a `ready` result for every requested ID, and persist only those IDs. Route read models preserve `unavailable` or `missing` results so later lifecycle drift is visible. The Route editor obtains active choices through a Route-owned `/api/routes/location-options` read endpoint backed by the same owner resolver.

Forbidden mechanisms include imports from `uok_locations_core._internal`, `modules/locations.core`, Location models/services/schemas, `location_definitions` SQL or metadata inspection, feature foreign keys, cross-module joins, raw SQL, and copied authoritative Location facts in Route tables.

## 7. Data Ownership And Migration Plan

`modules/routes.core/migrations/001_routes_core.sql` creates only:

- `route_definitions` — aggregate identity, metadata, lifecycle, version, and actor/timestamps;
- `route_stops` — same-owner ordered stable Location IDs and stop roles;
- `route_name_history` — same-owner append-only canonical-name changes.

Only `route_stops.route_definition_id -> route_definitions.id` and `route_name_history.route_definition_id -> route_definitions.id` are feature-local foreign keys. `location_definition_id` is a bounded string with no database foreign key to `location_definitions`. Tenant-first uniqueness/indexes cover route code, route stop sequence, list filters, Location-reference lookup, and history reads.

Root and every foreign module migration must be rejected if it creates, alters, references, or drops these owner tables. Route migrations must be rejected if they reference Location, Planning, Contacts, Product, Reports, Calendar, Communications, or future Shipment tables.

## 8. Relationship Rules

- **Location:** stable IDs only; all validation and display resolution use the immutable Location owner API described above. No joins, feature foreign keys, or copied names/codes.
- **Party:** Party remains the Contacts golden identity. Route stores no buyer, seller, agent, carrier, or Party address.
- **Product:** Product remains canonical material identity. Route stores no Product ID in this slice.
- **Planning:** no Planning facade, provider, model, resource, link, schedule, or UI changes. A future Planning reference may store a Route ID and resolve it only through the Route facade.
- **Future Shipment:** Shipment may store a Route ID and consume `RouteReferenceDTO`; it must own execution, booking, carrier, actual movement, and shipment-specific stops. It must not join Route tables.

## 9. Tenant Isolation

- Every Route list/detail/history and mutation predicate includes `actor.organization_id`.
- Organization identity never appears in request schemas or public DTOs.
- Code uniqueness is `(organization_id, code)` so different tenants may reuse a corridor code.
- Stop rows carry the Route tenant key and are written only beneath a same-tenant aggregate.
- Location validation is executed by `locations.core` with the same actor; a foreign-tenant Location ID resolves as missing and the Route write fails closed.
- Update/archive/restore use `(id, organization_id)` row locking plus `expected_version`.
- Read, command, and resolver entry points require the declared permissions and operational module state.

## 10. UI Surfaces

The module-owned **Route/Corridor Master** workspace provides:

- one command bar with search, lifecycle/mode filters, sort, refresh, and one trailing **New route** action;
- a route table/list showing code, name, origin, destination, waypoint count, mode hint, and status;
- a selected detail surface showing the ordered Location path, unavailable/archived Location state, version/timestamps, and canonical-name history;
- a shared editor popup for code/name/mode, active origin/destination selectors, and zero to eight ordered waypoint selectors;
- accessible **Add waypoint**, **Move up**, **Move down**, and **Remove** controls so drag is never required;
- edit, archive, and restore actions using optimistic versions and existing shared confirmation/editor patterns;
- read-only rendering for roles without `routes.manage`.

All DTOs, HTTP clients, state, commands, components, CSS, and tests remain under `modules/routes.core`. The surface imports only the neutral `ModuleSurfaceHostContext` and shared module-neutral controls; only the generated catalog imports `moduleSurface.tsx`.

## 11. Test Plan

### Domain And Owner Tests

- code/name/mode normalization, strict extra-field rejection, 2–10 unique ordered-stop rules, distinct endpoints, immutable code, positive version, and frozen DTOs;
- exact manifest, public facade, mapping, migration, permission, command/event, API-prefix, UI, and verifier contracts;
- lifecycle integration covering idempotency, permissions, optimistic concurrency, path/name updates, name history, archive filtering, restore, and correlated event payloads;
- tenant proof that two organizations may reuse a code while foreign Route IDs and foreign Location IDs fail on every read/write path;
- Location facade tests proving immutable DTOs, permission/operational checks, active/all filtering, input-order preservation, and no cross-tenant disclosure.

### UI Tests

- install/enable, signed-out, loading/error, and read-only states;
- Location-option loading through the Route API;
- search/filter/sort/detail/history behavior;
- create/edit payloads, waypoint add/reorder/remove, validation, optimistic lifecycle actions, and refresh revision;
- keyboard labels, popup focus/dismissal, narrow layout, and non-color status meaning.

### Architecture And Release Gates

- add `tests/test_route_location_data_boundary.py` to fail on any Route import except exact supported Location facade symbols and on any Location table/ORM/repository/schema/raw-SQL reference;
- extend generic public-facade, Host allowlist, model registry, migration discipline, physical boundary, manifest/release, verifier, frontend catalog, generated contract, and shell-cycle tests for `routes.core`;
- keep `tests/test_planning_data_boundary.py` and all Gap 1–3 tests unchanged in intent and green;
- run focused owner suites, full sequential Python runner, generated-contract drift, Vitest, static build, `TechnologyAudit`, `EngineeringEvidence`, `Audit`, local `Rebuild`, local `Verify`, candidate verifier, browser proof, and hosted CI.

## 12. Architecture Freeze Compliance Checklist

- [x] Route/Corridor is a distinct capability with its own aggregate, tables, lifecycle, permissions, API, UI, and verifier.
- [x] Location remains the owner of place identity and receives only a two-symbol immutable query surface justified by the real Route caller.
- [x] Route stores only stable Location IDs and uses no foreign ORM, table, join, foreign key, repository, schema, or copied master data.
- [x] Host work is limited to existing manifest-driven DI/auth/router/model composition and exact tested request-adapter imports.
- [x] Kernel receives no file, mapping, contract, helper, permission, or allowlist growth.
- [x] Planning, Contacts, Product, Reports, Calendar, Communications, and Shell internals are unchanged.
- [x] The Route frontend is owner-local and composed only through the neutral generated surface contract.
- [x] New dependency and data-access enforcement is designed before the cross-module read is introduced.
- [x] Tenant, authorization, lifecycle, optimistic concurrency, and audit behavior stay inside the owning modules.
- [x] Gap 1–3 gates remain mandatory and no existing facade is weakened.

## 13. Non-Goals

- Shipment execution, booking, bills of lading, cargo lots, inventory, dispatch, carrier workflow, or Planning rewrite.
- Real-time tracking, telematics, ETA feeds, carrier integrations, schedules, service calendars, rates, or capacity.
- Optimization, shortest-path, distance, duration, emissions, geocoding, coordinates, maps, polygons, or a GIS graph.
- Intelligence/Oracle scoring, recommendations, anomaly detection, or corridor risk.
- Party, Product, Contacts, Planning, Reports, Calendar, Communications, or Shipment table references or joins.
- Activating Planning's Location provider, adding a Route provider to Planning, or widening Planning/Contacts facades.
- Separate Corridor and Leg aggregates, route variants, nested routes, circular paths, bulk import/export, hard delete, path-version restore, or global route catalogs.
- Kernel growth, module restructuring, shell contract changes, microservices, or unrelated refactors.

## Validation

Implementation acceptance requires the exact gates in the active architecture freeze, owner backend/frontend suites, the new Route-to-Location boundary test, generated-contract drift checks, a rebuilt local candidate, an authenticated Route verifier, browser/runtime proof, GitHub preflight/readiness, and green hosted CI.
