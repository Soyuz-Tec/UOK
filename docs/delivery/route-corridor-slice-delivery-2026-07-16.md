# Route/Corridor Master Slice Delivery – 2026-07-16

**Status:** Implementation and local candidate qualification complete; draft pull-request publication and hosted CI in progress.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/route-corridor-slice-design-2026-07-16.md`

## What Shipped

UOK now has one tenant-scoped Route/Corridor Master capability in `routes.core`:

- canonical Route Definitions with organization-unique immutable codes;
- optional controlled `sea`, `road`, `rail`, `air`, or `multimodal` mode hints;
- ordered paths containing one origin, zero to eight waypoints, and one destination;
- stable Location IDs validated and resolved only through the `locations.core` immutable owner facade;
- create, update, recoverable archive, and restore commands with optimistic versions;
- append-only canonical-name history and correlated create/update/archive/restore events containing ordered Location IDs;
- actor-authorized organization-scoped list, detail, Location-option, name-history, and stable-reference reads;
- immutable, serialization-safe HTTP and cross-module reference DTOs with no ORM or organization object leakage;
- a module-owned Route/Corridor Master workbench for search/filter, detail/history, create/edit, accessible waypoint ordering, archive, and restore;
- a closed manifest, owner migration, owner tests, exact Route-to-Location enforcement, generated contracts, and a runtime candidate verifier.

Location remains the canonical place owner. Party remains the golden identity record in `contacts.core`; Product remains owned by `product.master`; Planning and Shipment behavior are not embedded in Route.

## API, Commands, And Data

### Location owner facade additions

`modules/locations.core/backend/uok_locations_core/public_api.py` adds exactly:

1. `LocationReferenceResolution`
2. `resolve_location_references`

The frozen batch DTO contains only requested Location ID, explicit `ready | unavailable | denied | missing` status, optional code/name/type/country value data, and a status summary. Resolution is permission-aware, module-operational, organization-scoped, input-order preserving, and ORM-free. With no requested IDs it returns only active Location choices for the Route editor.

### Route owner facade

`modules/routes.core/backend/uok_routes_core/public_api.py` exposes exactly:

1. `RouteReferenceDTO`
2. `api_router`
3. `command_handlers`
4. `command_permissions`
5. `resolve_route_reference`
6. `role_grants`

No ORM model, repository, service, SQLAlchemy expression, session factory, mutable entity, or tenant identity is public.

### HTTP and command contract

- `GET /api/routes/location-options`
- `GET /api/routes/definitions`
- `GET /api/routes/definitions/{route_definition_id}`
- `GET /api/routes/definitions/{route_definition_id}/name-history`
- `CreateRouteDefinition`
- `UpdateRouteDefinition`
- `ArchiveRouteDefinition`
- `RestoreRouteDefinition`
- `routes.read`
- `routes.manage`

### Owner data

`modules/routes.core/migrations/001_routes_core.sql` creates only:

- `route_definitions`
- `route_stops`
- `route_name_history`

Only same-owner Route foreign keys exist. `route_stops.location_definition_id` is a bounded stable string and has no foreign key to `location_definitions`. Route tables contain no copied Location code, name, type, country, or ORM payload.

## Files And Migrations Touched

| Area | Paths |
|---|---|
| Design and delivery | `docs/delivery/route-corridor-slice-design-2026-07-16.md`; `docs/delivery/route-corridor-slice-delivery-2026-07-16.md` |
| Module plan | `docs/modules/routes.core/ROUTE_CORRIDOR_MODULE_PLAN.md`; updated `docs/modules/locations.core/LOCATION_MASTER_MODULE_PLAN.md` |
| Closed module contract | `modules/routes.core/manifest.yaml`; module-local README files |
| Private backend and facade | `modules/routes.core/backend/uok_routes_core/**`; `modules/locations.core/backend/uok_locations_core/public_api.py` |
| Owner migration | `modules/routes.core/migrations/001_routes_core.sql`; migration README |
| Owner backend tests | `modules/routes.core/tests/test_route_corridor_domain.py`; `test_route_corridor_integration.py`; `test_route_location_behavior.py`; `test_route_tenant_isolation.py`; `route_test_support.py`; `modules/locations.core/tests/test_location_reference_api.py` |
| Owner frontend and tests | `modules/routes.core/web/src/**`; `modules/routes.core/tests/web/**` |
| Candidate verifier | `modules/routes.core/verify/UokCandidateRouteCorridor.ps1`; verifier README |
| Architecture enforcement | `tests/test_route_location_data_boundary.py`; public-facade, Host allowlist, model registry/fixtures, migration discipline, physical/manifest, verifier, and frontend catalog gates; `src/uok/migration_registry.py` |
| Generated contracts | `web/src/generated/openapi.json`; `openapi.d.ts`; `moduleSections.ts`; `moduleSurfaceCatalog.ts` |
| Living architecture catalog | `docs/ARCHITECTURE.md`; `docs/DOCUMENTATION_INDEX.md`; ADR-0028; active freeze; module extension/boundary/roadmap docs; `modules/README.md` |

The dated modular-monolith re-audit, Planning/Contacts source, Kernel contracts, neutral shell contract, Product implementation, and unrelated features were not rewritten.

## Location Public-API-Only Proof

- Route production code has exactly one Location import site: `modules/routes.core/backend/uok_routes_core/_internal/delivery/location_gateway.py` imports only named `LocationReferenceResolution` and `resolve_location_references` symbols from `uok_locations_core.public_api`.
- `tests/test_route_location_data_boundary.py` AST-scans all Route production Python and SQL. It rejects Location package/facade-object/wildcard/private/dynamic imports, Location ORM symbol and table literals, SQLAlchemy reflection/metadata escape hatches, raw SQL, and foreign-key references to Location tables.
- `tests/test_module_public_api_boundaries.py` independently rejects every unsupported Location or Route import from external owners.
- `tests/test_migration_discipline.py` proves Route migrations cannot reference `location_definitions` and root/foreign migrations cannot claim Route tables.
- `tests/fixtures/module_model_registry.json` and `module_model_metadata.json` prove Route's three mappings have only owner-local feature foreign keys; the Location ID column has none.
- `modules/routes.core/tests/test_route_location_behavior.py` proves later-archived Location records remain explicit `unavailable` read values while new writes using archived/missing references fail closed.
- `modules/routes.core/tests/test_route_tenant_isolation.py` proves a foreign-tenant Location ID is indistinguishable from missing and cannot be persisted.

## Tenant And Audit Proof

- Every Route list/detail/history and mutation predicate includes the authenticated actor's `organization_id`.
- Organization identity is never accepted from request payloads or returned in public DTOs.
- Code uniqueness is `(organization_id, code)`, allowing different tenants to reuse one corridor code.
- Update/archive/restore use `(id, organization_id)` row locking plus `expected_version`.
- Route stop rows carry the owner tenant key and are replaced only below a locked same-tenant aggregate.
- Location owner resolution uses the same actor and tenant, returns no foreign-tenant facts, and verifies Location module lifecycle and `locations.read`.
- Canonical-name changes append immutable history; command/event evidence records correlation, lifecycle, version, and ordered stable Location IDs.

## Architecture Freeze Compliance

**Compliant:** Yes.

| Freeze rule | Evidence |
|---|---|
| Feature behavior stays in owner | `modules/routes.core/backend`, `web/src`, `migrations`, `tests`, and `verify` |
| Location owns place data | Only named frozen Location facade symbols are used; no ORM/table/FK/join/copy |
| Host remains composition only | Route API imports only exact allowlisted `uok.host.database.get_db` and `uok.host.security.current_actor` seams |
| Kernel remains stable | No Kernel file, mapping, port, contract, or permission rule was added |
| Narrow public APIs | Exact six-symbol Location and Route facades are enforced; only two Location symbols were added for this real caller |
| Shell remains neutral | Route surface is module-owned and composed only by the generated catalog through unchanged `ModuleSurfaceHostContext` |
| Planning/Contacts stay frozen | No facade or implementation change in either owner; Gap 1–3 tests remain unchanged in intent |
| New owner is justified | Route has a distinct aggregate, three tables, lifecycle, permissions, API, UI, verifier, and Location dependency |

The accepted in-process Host adapter inventory increases from 31 to 33 exact imports because the one Route HTTP adapter uses the same two approved DI/auth seams as Product and Location. ADR-0028 and the active freeze record this bounded addition. No new cross-owner SCC, Kernel dependency, or shell backedge is introduced.

## Verification And CI Status

Current completed results:

| Gate | Result |
|---|---|
| Location + Route owner backend suites | Pass — 28 tests |
| Route owner frontend suite | Pass — 10 tests |
| Route-to-Location boundary | Pass — 15 tests |
| Shared architecture/enforcement suite | Pass — 135 tests |
| Frozen Gap 1–3 boundary command | Pass — 33 tests |
| Python compilation | Pass |
| Generated OpenAPI and module catalogs | Pass — drift-free |
| Container verifier asset validation | Pass — 9 runtime-proven verifier assets |
| Module release contract | Pass — 10 modules, 92 commands, 102 events, zero violations |
| Model registry | Pass — 56 mappings: 47 feature + 9 Kernel |
| Full `TechnologyAudit` | Pass — required artifacts, pinned Python stack, typed frontend, runtime alignment, module shape, documentation references, source-size, operations, engineering-system, and GitHub guardrails |
| Full `EngineeringEvidence` | Pass — ignored evidence written to `var/evidence/engineering/uok_engineering_20260717T024413Z.json` |
| Full `Audit` | Pass — 130 unique Python test files; Python and frontend dependency audits report no known vulnerabilities; generated contracts, release contract, source/naming/size/folder gates all green |
| Local candidate `Rebuild` | Pass — image rebuilt; `/health` returned `ok`; offline and live database-capacity policies passed |
| Local candidate `Verify` | Pass — 130/130 Python files; 114 Vitest files / 423 tests; production TypeScript/Vite build; 19 Playwright passes + 1 environment-gated skip; all 9 module verifiers passed |
| Browser/runtime Route proof | Pass — created a three-stop sea corridor through Location choices, renamed it with history, archived/restored it, proved a 390 px layout without page overflow, and observed zero browser warnings/errors |
| Draft pull request and hosted CI | Pending local qualification |

The local engineering-evidence artifact remains ignored under `var/`. The browser proof used `UI-PROOF-CORRIDOR-20260716`, resolving origin, waypoint, and destination from Location Master; the record finished restored and active at version 4. The pull-request row will be updated with exact final-head evidence before handoff.

## Manual Demo

After the rebuilt candidate is healthy:

1. Sign in as an operations manager, trader, or platform administrator.
2. In **Location Master**, ensure active records exist for `KE-MOMBASA-PORT`, `ZA-DURBAN-PORT`, and `IN-TUTICORIN-PORT` (V.O.C. Port / Thoothukudi).
3. Install `routes.core`; its declared dependency keeps `locations.core` operational.
4. Open **Route/Corridor Master** and choose **New route**.
5. Create code `RCN-AFRICA-VOC`, name `Africa to V.O.C. RCN Corridor`, mode `Sea`, origin Mombasa, waypoint Durban, and destination V.O.C. Port.
6. Search/select the route and confirm the ordered path, Location codes/types/countries, status, and version are resolved from Location Master.
7. Choose **Edit**, add or reorder a waypoint with the labelled controls, rename with a reason, save, and confirm **Name history** plus the new optimistic version.
8. Archive the route and confirm it leaves the Active filter but appears under All/Archived; restore it and confirm it returns to Active.
9. Sign in as a viewer and confirm reads remain available while mutation controls are absent.

## Residual Risks

- FastAPI session/auth injection remains an accepted in-process Host adapter seam; extraction would replace the adapter without changing Route domain behavior.
- Static enforcement cannot prove every computed string/import or native database extension. Route uses none of those mechanisms; AST, migration, model-registry, review, and runtime gates remain required.
- Later archival or deletion of a referenced Location does not rewrite Route. Reads deliberately expose `unavailable` or `missing`, while path updates require all active references.
- Route event history records ordered Location IDs but this slice does not offer path-version rollback or a separate leg-history aggregate.
- Transport mode is a descriptive hint, not a schedule, carrier service, distance, duration, or optimization claim.

No P0 architecture, tenancy, authorization, or data-ownership residual is currently known.

## Recommended Next Slice

The strongest next evidence-backed option is a thin tenant-scoped **Shipment Support** owner, but only after the team locks the minimum shipment-header facts. Planning already reserves a `shipment` typed-link provider, and Route now exposes an immutable stable-reference DTO; a Shipment owner could therefore hold its own lifecycle and reference Route through the facade without inheriting topology or joining Route/Location tables. Keep booking, carrier integration, real-time tracking, optimization, and accounting outside that first slice. If those shipment facts are not yet settled, implement a small Compliance Document Type registry before attempting Intelligence, because Intelligence still lacks authoritative operational signals to score.
