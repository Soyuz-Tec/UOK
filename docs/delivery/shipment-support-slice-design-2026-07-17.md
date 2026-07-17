# Shipment Support Slice Design – 2026-07-17

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Shipment Evidence And Available Owner APIs

UOK has no implemented Shipment or Cargo aggregate. Repository and Git-history inspection finds no `shipments.core` or `cargo.transactions` module, Shipment/Cargo ORM mapping, table, migration, API, command/event, verifier, or module-owned UI. `src/uok/migration_registry.py` reserves the future `cargo_transactions` table name as enforcement vocabulary only; it does not implement that table.

Planning contains typed-reference placeholders, not Shipment data:

- `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` reserves `shipment.provider`, owner `shipments.core`, and permission `shipments.read`, but currently returns `unavailable` because no provider implementation exists.
- `modules/planning.core/backend/uok_planning_core/_internal/persistence/planning_models.py`, `modules/planning.core/migrations/005_planning_operation_links.sql`, and `modules/planning.core/migrations/008_planning_task_requirements.sql` own generic stable target IDs and readiness gates. They have no Shipment foreign key or copied Shipment row.
- `modules/planning.core/web/src/PlanningOperationLinksPanel.tsx` and `PlanningRequirementsPanel.tsx` expose `shipment` as a generic link/requirement type. They do not provide Shipment lifecycle behavior.
- ADR-0004 and ADR-0007 deliberately keep the Shipment provider unavailable until an owner supplies an organization-scoped authorization contract.

The legal immutable owner surfaces are:

| Owner | Existing public symbols relevant to Shipment | First-slice use |
|---|---|---|
| Party / `contacts.core` | `PartyReferenceResolution`; `resolve_party_reference(db, actor, party_id)` in `modules/contacts.core/backend/uok_contacts_core/public_api.py` | Resolve required shipper and consignee IDs. The single-ID API is used as written; Contacts is not widened. |
| Product / `product.master` | None. `public_api.py` exposes only four Host-composition hooks. | Not used. Product is optional in the brief and cannot legally be referenced until its owner publishes a real immutable reference contract. |
| Location / `locations.core` | `LocationReferenceResolution`; `resolve_location_references(db, actor, ids=None)` in `modules/locations.core/backend/uok_locations_core/public_api.py` | Resolve required origin/destination IDs and provide active Location choices. |
| Route / `routes.core` | `RouteReferenceDTO`; `resolve_route_reference(db, actor, route_definition_id)` in `modules/routes.core/backend/uok_routes_core/public_api.py` | Existing identity resolution is available, but it does not expose the ordered Location path required to validate a Shipment corridor. |

The Route delivery report and module plan identify a thin Shipment Support owner as the next evidence-backed slice. The mandatory Product/Cargo separation policy reserves the broader commercial/physical Cargo aggregate for future `cargo.transactions`.

## 2. Gap After Route/Corridor

Operators can govern Parties, Products, Locations, and reusable Route/Corridor paths, but cannot record that a specific tenant shipment is planned or moving between two places for a shipper and consignee. Planning can store a raw Shipment target ID, yet no owner can authorize or describe that target, so Shipment-backed readiness always fails closed.

The smallest valuable gap is an operational Shipment header with an auditable movement lifecycle. It must reference existing master data without copying it, express an Africa-to-V.O.C./Thoothukudi corridor, and remain deliberately smaller than a transportation-management, cargo-trading, compliance, inventory, or tracking system.

## 3. Domain Model And Status Machine

### Shipment

`Shipment` is the tenant-owned aggregate root:

| Field | Rule |
|---|---|
| `id` | Stable generated Shipment identifier |
| `organization_id` | Mandatory tenant owner; always derived from the authenticated actor |
| `code` | Required normalized uppercase/hyphenated code; immutable and unique within one organization |
| `shipper_party_id` | Required stable Party ID resolved through Contacts |
| `consignee_party_id` | Required stable Party ID resolved through Contacts |
| `origin_location_id` | Required stable active Location ID |
| `destination_location_id` | Required stable active Location ID and different from origin |
| `route_definition_id` | Optional stable active Route ID |
| `planned_departure_on` | Optional calendar date |
| `planned_arrival_on` | Optional calendar date, not earlier than departure |
| `status` | `draft`, `planned`, `in_transit`, `arrived`, `closed`, or `cancelled` |
| `version` | Positive optimistic-concurrency version |
| actor/timestamps | Creator, last updater, created/updated time |

The first slice has one Shipment header and no persisted leg collection. A selected Route supplies the governed corridor path; Shipment still stores its explicit actual origin and destination IDs so it remains readable and queryable if no Route is known. When a Route is supplied, its first and last Location IDs must match the Shipment endpoints.

Product/material is intentionally absent. A product line without an owner DTO would violate the freeze, while adding cargo quantity, grade, price, title, payment, or document semantics would overlap the separately reserved `cargo.transactions` capability.

### Lifecycle

Create always starts at `draft`, version `1`. Allowed transitions are:

```text
draft -> planned | cancelled
planned -> in_transit | cancelled
in_transit -> arrived
arrived -> closed
closed | cancelled -> terminal
```

Every transition requires the current expected version and a non-empty reason. Header edits require optimistic version matching and are allowed only in `draft` or `planned`; status changes use a dedicated command. There is no hard delete, archive/restore alias, backwards transition, booking workflow, or exceptional in-transit cancellation in this slice.

### History And Audit

`ShipmentStatusHistory` is append-only and records previous/new status, reason, actor, version, and timestamp for each transition. Normal UOK command/event evidence records create, update, and status transition correlation. Header-update events carry stable reference IDs and planned dates; they never copy authoritative owner names, codes, ORM objects, or tenant objects.

## 4. Owning Module And Justification

Create `modules/shipments.core` as one optional `business_module` with canonical backend, web, migrations, tests, and verifier folders.

`shipments.core` is already the owner name reserved by Planning. It is justified as a new module because the Shipment aggregate has its own lifecycle, two owned tables, permissions, commands/events, public reference contract, UI, and runtime verifier. It must not expand:

- Planning, which owns projects, tasks, links, and readiness only;
- Route, which owns reusable corridor topology only;
- Location, which owns place identity only;
- Contacts, which owns Party identity only; or
- `cargo.transactions`, which remains a future commercial/physical cargo-lot, product, quantity, document, payment, and closeout capability.

The module declares dependencies on `contacts.core`, `locations.core`, and `routes.core`; API prefix `/api/shipments`; workbench section `shipments`; and permissions `shipments.read` and `shipments.manage`. Product is not a dependency.

The already-reserved Planning resolver gains one private branch that calls the Shipment facade. This activates an existing generic reference without widening Planning's seven-symbol facade, changing Planning-owned tables, or importing Shipment internals.

## 5. Minimal Public API Symbols

### Shipment owner facade

`uok_shipments_core.public_api` exposes exactly:

1. `ShipmentReferenceDTO` — frozen value data containing Shipment ID, reference status, code, lifecycle status, display label, status summary, and neutral open path.
2. `resolve_shipment_reference(db, actor, shipment_id)` — tenant-, permission-, and module-lifecycle-aware stable-ID resolution with no ORM leakage.
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

Persisted `closed` and `cancelled` Shipments remain valid `ready` references with their lifecycle status shown; only denied, missing, or provider-unavailable references fail resolution. This allows audit/readiness links to retain truthful historical targets.

### Route owner facade extension

The real Shipment caller requires the ordered route endpoints, which `RouteReferenceDTO` intentionally does not expose. Add exactly:

1. `RoutePathReferenceDTO` — frozen Route identity plus an immutable ordered tuple of Location IDs.
2. `resolve_route_path_references(db, actor, route_definition_ids=None)` — tenant-scoped batch resolver; requested IDs preserve order and active choices are returned when IDs are omitted.

This is a bounded Route-owned query surface for a real caller. It returns no Route/Stop ORM objects or mutable collections. The existing Route symbols remain compatible, and the Route module plan/public-facade contract will record the eight-symbol surface.

No Contacts, Planning, Product, or Location facade is widened.

## 6. Exact Cross-Module Calls

| Shipment call site | Owning module API | Immutable DTO consumed | Purpose |
|---|---|---|---|
| `shipments.core` Party gateway | `uok_contacts_core.public_api.resolve_party_reference` | `PartyReferenceResolution` | Validate and render shipper/consignee Party IDs. |
| `shipments.core` Location gateway | `uok_locations_core.public_api.resolve_location_references` | `LocationReferenceResolution` | Validate and render origin/destination IDs and provide active editor choices. |
| `shipments.core` Route gateway | `uok_routes_core.public_api.resolve_route_path_references` | `RoutePathReferenceDTO` | Validate an optional Route, match its endpoints, and provide active editor choices. |
| Planning's existing typed-link resolver | `uok_shipments_core.public_api.resolve_shipment_reference` | `ShipmentReferenceDTO` | Resolve a Shipment target without Shipment ORM/table access. |

All imports are named imports from `*.public_api`. Facade-object imports, wildcard imports, dynamic imports, owner `_internal` packages, model/repository/schema imports, and HTTP loopback calls are forbidden.

## 7. Data Ownership And Migration Plan

`modules/shipments.core/migrations/001_shipments_core.sql` creates only:

| Table / mapping | Purpose |
|---|---|
| `shipments` / `Shipment` | Tenant-owned operational Shipment header, references, lifecycle, dates, version, and actor/timestamp evidence |
| `shipment_status_history` / `ShipmentStatusHistory` | Same-owner append-only lifecycle transitions |

Only the history-to-Shipment relationship is an owner-local feature foreign key. Party, Location, and Route IDs are bounded strings with no database foreign key to `parties`, `location_definitions`, `route_definitions`, or any Product/Planning table.

The migration provides tenant/code uniqueness, lifecycle and date-order checks, positive-version checks, tenant/status/date/reference indexes, and the same universal organization/user references already permitted by the freeze. The module declares existing generic `CommandLog:shipments.core` and `EventRecord:Shipment` evidence without querying Kernel tables.

Root and foreign module migrations must be rejected if they create, alter, reference, or drop Shipment-owned tables. Shipment migrations must be rejected if they reference any Contacts, Product, Location, Route, Planning, Reports, Calendar, or Communications table.

## 8. No Foreign ORM, Table, Or Join Rules

- Shipment persists stable IDs only and asks the owning facade to validate or render each reference.
- Shipment production code may import only the exact named DTO/function symbols listed in section 6.
- No Shipment SQL may mention Party, Product, Location, Route, Planning, or other feature tables.
- No cross-owner SQLAlchemy relationship, metadata lookup, reflection, raw SQL, feature foreign key, repository/session factory, schema, or cross-module join is allowed.
- Later owner archival does not rewrite Shipment. Reads report the current owner resolution as unavailable/missing while retaining the stored stable ID and Shipment history.
- New writes and edits fail closed unless every supplied foreign reference is currently `ready`.
- Product is not represented by a free-text substitute or copied Product fields.

## 9. Tenant Isolation

- Every Shipment list/detail/history and mutation predicate includes `actor.organization_id`.
- Organization identity is never accepted from request/command payloads or returned in public DTOs.
- Shipment code uniqueness is `(organization_id, code)`, allowing the same code in different tenants.
- Update and transition commands lock/select by both Shipment ID and organization, then enforce `expected_version`.
- Contacts, Location, and Route resolution uses the same immutable authenticated `Actor`; a foreign-tenant ID is indistinguishable from missing/denied and cannot be persisted.
- Reads require `shipments.read`; writes require `shipments.manage`; the owner must be operational.
- Status history first resolves the same-tenant Shipment and also filters by organization.
- Tests create two organizations with identical codes and prove cross-tenant list/detail/history/update/transition/reference access fails closed.

## 10. UI Surfaces

One module-owned **Shipment Support** workspace provides:

- a searchable/filterable Shipment list showing code, lifecycle status, shipper/consignee labels, origin/destination, optional Route, and planned dates;
- a selected detail view with resolved owner values, unavailable/missing indicators, version/timestamps, and status history;
- a **New shipment** form for code, Party IDs, Location choices, optional Route choice, and planned dates;
- an **Edit** form for mutable header references/dates while the Shipment is `draft` or `planned`;
- contextual lifecycle actions that expose only legal next states and require a reason;
- read-only rendering for actors without `shipments.manage`.

Location and Route options are served by Shipment-owned read endpoints backed by their owner facades. The first slice accepts explicit stable Party IDs because Contacts exposes only a single-reference resolver and its facade is frozen. The UI remains under `modules/shipments.core/web/src`, imports only the neutral `ModuleSurfaceHostContext` and module-neutral shared controls, and is composed through the generated catalog.

## 11. Test Plan

### Domain And API

- Validate code/date/reference normalization, distinct endpoints, strict extra-field rejection, immutable code, controlled statuses, legal transitions, terminal-state behavior, and frozen DTOs.
- Prove create/update/status commands, idempotency, expected-version conflicts, status-history append semantics, permission denial, lifecycle disablement, and correlated events.
- Prove Party/Location/Route validation, route-endpoint matching, active option reads, later owner archival behavior, and no Product dependency.
- Prove list/detail/history filters and reference resolution, including closed/cancelled historical records.

### Tenant Isolation

- Reuse one Shipment code in two organizations.
- Reject foreign-tenant Party, Location, Route, and Shipment IDs without disclosing their existence.
- Reject cross-tenant detail, history, update, transition, and public-reference access.

### Frontend And Runtime

- Cover loading/error/signed-out/install/read-only states, filters, detail/history, create/edit payloads, legal status actions, validation, refresh, focus/dismissal, and narrow layout.
- Add a module-owned candidate verifier for installation, master-data resolution, lifecycle, history, tenant-safe reads, disable fail-closed, and recovery.
- Prove the RCN corridor flow against the rebuilt PostgreSQL candidate and through the browser.

### Architecture Gates

- Add `tests/test_shipment_foreign_data_boundary.py` to reject every Shipment import except exact named Contacts/Location/Route facade symbols and to reject all foreign model/table/repository/schema/raw-SQL/reflection/foreign-key access.
- Extend exact module-public-facade enforcement for the Shipment and Route surfaces.
- Extend Host adapter allowlists only for the Shipment HTTP adapter's existing `get_db` and `current_actor` seams.
- Extend model registry/metadata, migration ownership, physical module shape, manifest/release, verifier, frontend-catalog, generated-contract, and documentation gates.
- Keep `tests/test_planning_data_boundary.py` and all Gap 1–3 tests unchanged in intent and green; add a public-only Planning-to-Shipment resolver assertion for the activated reserved provider.
- Run the sequential TechnologyAudit, EngineeringEvidence, Audit, Rebuild, Verify, browser, GitHub preflight/readiness, and hosted CI workflow.

## 12. Architecture Freeze Compliance Checklist And Non-Goals

- [x] Shipment Support is a distinct operational capability with its own aggregate, tables, lifecycle, permissions, API, UI, and verifier.
- [x] Party, Location, and Route identity remain owned by their current modules and are consumed only through immutable public DTO APIs.
- [x] Product is omitted because no legal Product reference API exists and a Product line is not required for this demo.
- [x] `cargo.transactions` remains the future broader cargo/commercial owner; this slice does not duplicate it.
- [x] No foreign ORM/table/join/foreign key/copy is designed.
- [x] Host work is limited to existing manifest-driven composition and exact tested request-adapter seams.
- [x] Kernel receives no file, helper, mapping, contract, permission, or allowlist growth.
- [x] Planning and Contacts facades remain unchanged; any Planning activation is private and calls only the Shipment facade.
- [x] The two-symbol Route extension is justified by a real caller, immutable, owner-local, documented, and exact-contract tested.
- [x] The Shipment UI is owner-local and composed through the unchanged neutral shell contract.
- [x] New cross-owner enforcement precedes acceptance, and every Gap 1–3 gate remains mandatory.

### Non-Goals

- Carrier or freight-forwarder integration, booking, tendering, rates, quotations, capacity, dispatch, or schedules.
- Real-time tracking, AIS/GPS/telematics, tracking webhooks, ETA prediction, or exception feeds.
- Bills of lading, compliance packs, document vaults, customs filing, permits, certificates, or shipment-document workflow.
- Cargo lots, Product lines, quantities, grades, title, contracts, pricing, invoices, payments, inventory, WMS, or closeout evidence.
- Route optimization, alternate paths, persisted Shipment legs/stops, multi-route movement, distance, duration, maps, or GIS.
- Intelligence/Oracle scoring, recommendations, anomaly detection, or corridor risk.
- Planning project/task redesign, Shipment ORM access from Planning, automatic requirement decisions, or new Planning tables/facade symbols.
- Contacts/Messaging expansion, Party roles beyond shipper/consignee, Party search facade growth, or Product facade growth.
- Hard delete, status rollback, bulk import/export, microservices, module splits, Kernel growth, shell contract changes, or unrelated refactors.

## 13. Manual Demo Script

1. In Contacts, ensure two active tenant Parties exist for an RCN shipper and consignee and record their stable IDs.
2. In Location Master, ensure active Africa origin and V.O.C./Thoothukudi destination Locations exist.
3. In Route/Corridor Master, create or reuse an active corridor whose first/last Location IDs match those endpoints.
4. Install `shipments.core`; its declared dependencies keep Contacts, Location, and Route operational.
5. Open **Shipment Support** and create code `RCN-AFRICA-VOC-001` with the two Party IDs, origin, destination, optional corridor, and planned dates.
6. Confirm detail values resolve from owner DTOs, then edit a planned date while the record is still `draft`.
7. transition `draft -> planned -> in_transit -> arrived -> closed`, supplying a reason each time, and inspect the append-only status history/version increments.
8. Add the stable Shipment ID as a Planning `shipment` link and confirm the reserved provider returns `ready` without Planning reading Shipment tables.
9. Sign in under another tenant and prove the Shipment and every foreign reference are absent; sign in as a read-only role and confirm lifecycle controls are unavailable.

## Validation

Implementation acceptance requires the exact gates in the active architecture freeze, owner backend/frontend suites, Shipment-to-owner and Planning-to-Shipment boundary tests, generated-contract drift checks, a rebuilt local candidate, authenticated verifier evidence, browser proof of the complete lifecycle, GitHub preflight/readiness, and green hosted CI at the final PR head.
