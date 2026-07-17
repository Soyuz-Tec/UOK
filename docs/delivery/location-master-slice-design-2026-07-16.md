# Location Master Slice Design – 2026-07-16

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Define the next product-delivery slice on the frozen modular monolith before implementation begins.

**Scope:** One tenant-scoped Location Master capability for operational trade locations. Party remains the golden identity owned by `contacts.core`; this slice does not change Party, Product, Planning, or any existing module facade.

## 1. As-Is Location And Geography Foundation

No active UOK module, ORM mapping, migration, table, API, or UI currently owns canonical Location master data:

- `modules/calendar.core/backend/uok_calendar_core/models.py` and `modules/calendar.core/migrations/001_calendar_core.sql` store `CalendarEvent.location` as event-local free text. That field describes an appointment and is not a reusable location identity.
- `modules/contacts.core/backend/uok_contacts_core/_internal/persistence/models.py` stores Party address data inside the Contacts-owned Party aggregate. `modules/contacts.core/backend/uok_contacts_core/_internal/groups_relationships/group_smart_support.py` derives a display grouping from the last comma-delimited address segment; it does not define a Country or Location master.
- `modules/planning.core/backend/uok_planning_core/_internal/persistence/planning_resource_models.py` and `modules/planning.core/migrations/009_planning_typed_resources.sql` own Planning-local typed resource references. They store a stable external kind/ID pair, not foreign Location rows.
- `modules/planning.core/backend/uok_planning_core/_internal/persistence/planning_models.py` and `modules/planning.core/migrations/005_planning_operation_links.sql` likewise store consumer-local typed operation links.
- `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` reserves the exact future owner `locations.core`, provider `location.provider`, and permission `locations.read`, but deliberately reports that provider unavailable because no owner implementation exists.
- `tests/fixtures/module_model_registry.json` is the enforced inventory of current ORM ownership and contains no Location, Port, Warehouse, City, Region, Country, Site, Route, or Corridor mapping.

The existing `product.master` slice is the relevant quality pattern:

- `modules/product.master/backend/uok_product_master/public_api.py` exposes four composition symbols and no ORM models.
- `modules/product.master/backend/uok_product_master/_internal/persistence/models.py` keeps tenant-owned definition and append-only name-history mappings private.
- `modules/product.master/migrations/001_product_master.sql` provides organization-scoped uniqueness, lifecycle/version constraints, and same-owner history ownership.
- `modules/product.master/web/src` and `modules/product.master/verify/UokCandidateProductMaster.ps1` provide the module-owned workbench and runtime verifier pattern.

## 2. Gap Versus Product Master Completeness

Product Master now supplies a governed, tenant-scoped canonical Product Definition with an immutable code, recoverable lifecycle, optimistic updates, canonical-name history, immutable HTTP DTOs, a module-owned UI, and a candidate verifier. Operations still lack the equivalent stable identity for the physical and administrative places used in trade workflows.

Today a user can type a location into a calendar event or store a typed Location ID in Planning, but cannot define the authoritative tenant-owned record behind that ID. Ports, warehouses, cities, and regions therefore have no canonical code/name/type/country identity, no recoverable lifecycle, and no audit-friendly rename history. Reusing Calendar text, Party addresses, or Planning resources as the master would create a second source of truth and violate owner boundaries.

The smallest evidence-backed gap is a Location Definition registry. The prior Product Master delivery handoff in `docs/delivery/party-mdm-slice-delivery-2026-07-16.md` names canonical location code/name/type/country plus recoverable lifecycle as the next slice and explicitly defers Route topology and Planning resolver activation.

## 3. Location Model

### `LocationDefinition`

| Field | Rule |
|---|---|
| `id` | Stable generated Location ID |
| `organization_id` | Required tenant owner; always derived from the authenticated actor |
| `code` | Required, normalized uppercase, immutable after create, unique within the organization |
| `canonical_name` | Required operational display name |
| `location_type` | Required controlled value: `port`, `warehouse`, `city`, or `region` |
| `country_code` | Required normalized two-letter country code; syntactic linkage only, not a new global Country catalog |
| `status` | `active` or `archived` |
| `version` | Positive optimistic concurrency version |
| `created_by_user_id`, `updated_by_user_id` | Actor evidence |
| `created_at`, `updated_at`, `archived_at` | Lifecycle evidence |

### `LocationNameHistory`

Append-only evidence records the owning organization and Location ID, previous and new canonical names, change reason, actor, and timestamp. A row is appended only when the canonical name actually changes. Codes remain immutable, so this slice does not need code-history semantics.

### Lifecycle

- Create starts at `active`, version `1`.
- Update may change canonical name, type, and country code and must supply the current expected version.
- Archive is recoverable and excludes the record from default lists.
- Restore returns an archived record to active status.
- There is no hard delete.

This mirrors Product Master's proven lifecycle and history behavior without adding a hierarchy, coordinates, routing graph, global place catalog, or GIS semantics.

## 4. Owning Module And Minimal Public API

Create one optional capability module named `locations.core`. That name is already reserved by Planning and prevents a parallel `location.master` owner from emerging.

| Concern | Owner | Planned surface |
|---|---|---|
| Location validation, reads, writes, lifecycle, and history | `modules/locations.core` | Private `_internal` implementation |
| Runtime composition facade | `modules/locations.core/backend/uok_locations_core/public_api.py` | Exactly `api_router`, `command_handlers`, `command_permissions`, `role_grants` |
| Immutable HTTP read contract | `locations.core` | Frozen Pydantic response DTOs for definition and name-history data |
| HTTP routes | `locations.core` | `GET /api/locations/definitions`, `GET /api/locations/definitions/{id}`, `GET /api/locations/definitions/{id}/name-history` |
| Commands | `locations.core` | `CreateLocationDefinition`, `UpdateLocationDefinition`, `ArchiveLocationDefinition`, `RestoreLocationDefinition` |
| Permissions | `locations.core` | `locations.read`, `locations.manage` |
| Module UI | `modules/locations.core/web/src` | Canonical `moduleSurface.tsx`, section `locations` |
| Composition, auth, DB session, command bus | Host | Existing mechanisms only |

No existing public facade is widened. The module's Python facade remains a four-symbol composition surface; ORM mappings stay private behind the existing privileged manifest model-registration hook. HTTP responses are immutable serialization DTOs and never expose SQLAlchemy objects.

There is no current cross-module Location caller in this slice, so a speculative `resolve_location_reference` facade symbol is not added. A later Planning or Route integration must introduce an immutable owner DTO/query contract through the freeze exception process and prove a real consumer.

## 5. Data Ownership And Migration Plan

`locations.core` exclusively owns:

| Table / mapping | Purpose |
|---|---|
| `location_definitions` / `LocationDefinition` | Tenant-scoped canonical operational location identity and lifecycle |
| `location_name_history` / `LocationNameHistory` | Append-only canonical-name changes |

The module receives `modules/locations.core/migrations/001_locations_core.sql` with:

- transaction-wrapped creation of both tables;
- unique constraint on `(organization_id, code)`;
- checks for controlled type, lifecycle status, and positive version;
- tenant/list and tenant/history indexes;
- one same-owner foreign key from history to `location_definitions`;
- only established universal organization/user references outside the feature owner.

The module declares scoped use of Kernel command/event evidence (`CommandLog:locations.core` and `EventRecord:LocationDefinition`) through existing generic helpers. It does not query or own Kernel tables directly and has no Contacts, Product, Planning, Calendar, Reports, or other feature foreign key, join, read, or write.

## 6. Relationship Rules To Party, Product, And Future Route

- **Party:** `contacts.core` remains the golden identity owner. Party addresses remain Contacts data. A Location is not a Party and Location rows do not copy, replace, join, or foreign-key Party records.
- **Product:** `product.master` remains the Product Definition owner. Location rows contain no Product IDs or Product metadata.
- **Planning:** Planning may continue to store consumer-local typed Location IDs. This slice does not activate `location.provider`, import Planning internals, read Planning tables, or alter Planning's seven-symbol facade.
- **Future Route/Corridor:** a Route owner may store stable Location IDs and resolve them through a future immutable `locations.core` DTO/API. It must not join `location_definitions`, depend on Location ORM mappings, or copy authoritative Location payloads into Route tables.
- **Country linkage:** `country_code` is a normalized scalar identifier. This slice does not claim ownership of an ISO dataset or create a shared Country table. A future governed Country catalog would require its own evidence and boundary decision.

All future relationships are by stable ID or immutable owner DTO only. Cross-module ORM relationships, feature foreign keys, and joins are forbidden.

## 7. Tenant Isolation Approach

- Every Location Definition query includes `LocationDefinition.organization_id == actor.organization_id`.
- History reads first require an organization-scoped owner lookup and also filter history by the actor organization.
- Every command derives organization ownership from the authenticated immutable `Actor`; request payloads cannot select a tenant.
- Update, archive, and restore locate rows by both `id` and `organization_id`, then enforce the supplied expected version under a row lock.
- Code uniqueness is database-enforced per organization, so different tenants may safely reuse the same location code.
- API reads require `locations.read`; writes require `locations.manage`; module-operational state is checked before reads.
- UI visibility is convenience only. Backend permission and tenant predicates are authoritative.
- Tenant tests will create the same code in two organizations and prove cross-tenant detail, history, update, archive, and restore attempts fail closed.

## 8. UI Surfaces

One module-owned **Location Master** workspace is added through the generated neutral module-surface catalog. It contains only:

- a searchable/filterable Location Definition results table;
- a selected-record detail and name-history view;
- a `New Location` form;
- an `Edit` form for canonical name, location type, country code, and change reason;
- contextual `Archive` and `Restore` commands.

The UI uses the existing shell host context, shared command bar, shared table/overlay primitives, semantic tokens, accessible labels/focus, and standard action vocabulary. Module DTOs, routes, state, CSS, and tests remain under `modules/locations.core`. The shell receives only the generated catalog entry and gains no Location-specific logic or reverse import.

## 9. Test Plan

### Domain and unit

- Validate code normalization, required canonical name, controlled location type, country-code normalization, forbidden extra fields, and frozen response DTOs.
- Prove create, update, archive, and restore behavior; expected-version conflicts; idempotent command handling; and name-history append semantics.
- Prove an unchanged canonical name does not create false history and that code cannot be updated.

### API and integration

- Install `locations.core`, create/update/archive/restore through the command bus, read list/detail/history through HTTP, and verify normal event/audit correlation.
- Prove default list filtering, explicit archived inclusion, permission failures, and fail-closed behavior when the module is disabled.
- Create two organizations with the same code and prove all reads/writes/history remain tenant-isolated.
- Add a module-owned candidate verifier that exercises install, lifecycle, history, filtering, disable fail-closed, and recovery against the rebuilt PostgreSQL candidate.

### Frontend

- Add module-owned Vitest coverage for load, search/filter, detail/history, create, edit, archive, restore, permission/install states, and accessible command reachability.
- Regenerate and drift-check the compile-time module-surface catalog and OpenAPI client contracts.

### Architecture gates

- Enforce the exact four-symbol Location facade and reject all outside imports of Location internals.
- Allow only the Location HTTP adapter's exact Host imports of `get_db` and `current_actor`; keep all other Host imports forbidden.
- Register the two owner mappings and migration; prove foreign modules cannot reference Location tables.
- Keep Planning foreign-ORM, Planning/Contacts facade, Kernel/Host, shell/module cycle, model ownership, manifest, migration-discipline, and generated-contract gates green.
- Run the full sequential TechnologyAudit, EngineeringEvidence, Audit, Rebuild, and Verify workflow before delivery.

## 10. Architecture Freeze Compliance Checklist

- [x] Feature behavior is designed only under the new owner `modules/locations.core`.
- [x] The new module is one clear capability and uses Planning's already-reserved owner name; no existing module is split.
- [x] Host changes are limited to existing manifest-driven composition and the exact tested HTTP adapter imports; no business logic moves to Host.
- [x] Kernel receives no new port, contract, helper, mapping, or permission rule.
- [x] Party remains the `contacts.core` golden identity and Product remains owned by `product.master`.
- [x] No existing facade is widened; Planning and Contacts public surfaces remain unchanged.
- [x] No foreign ORM/table access, cross-module join, feature foreign key, or shared Location table is designed.
- [x] The new module has a closed manifest, private mappings, owned migration/tests/verifier/UI, immutable DTOs, and an exact four-symbol facade.
- [x] The shell imports the Location surface only through the generated catalog and neutral `ModuleSurfaceHostContext`; no shell/module backedge is added.
- [x] Gap 1–3 gates and the accepted internal-only Planning SCC remain unchanged.
- [x] Runtime verification and hosted CI remain release requirements.

## 11. Non-Goals

- Full Route/Corridor topology, route optimization, multi-leg shipment planning, schedules, distances, transit times, or carrier logic.
- Planning resolver activation or any change to Planning tables, internals, UI, or facade.
- Intelligence/Oracle scoring, recommendations, geospatial analytics, maps, geocoding, coordinates, polygons, or time-zone services.
- A global Country, port, UN/LOCODE, GIS, or postal-address catalog; country-code validation is intentionally syntactic.
- Warehouse capacity, inventory, bins, yards, terminals, berths, contacts, operating hours, or shipment execution.
- Party-address migration, Party/Location dedupe, Product/Location links, Cargo/Shipment links, Compliance records, aliases, bulk import/export, merge, or hard delete.
- Broad Contacts or Planning refactors, module splits, microservices, Kernel growth, shell contract changes, or unrelated structure work.

## Validation

Implementation acceptance requires the commands frozen in `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, the new `locations.core` backend/frontend suites, generated-contract drift checks, a local candidate rebuild and Location verifier, browser/runtime proof, and green hosted CI.
