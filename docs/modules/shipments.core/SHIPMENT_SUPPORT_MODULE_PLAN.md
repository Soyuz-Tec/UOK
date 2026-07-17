# Shipment Support Module Plan

**Module:** `shipments.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/shipments.core`

## Purpose And Authority

`shipments.core` is the optional operational Shipment owner. It governs a
tenant-scoped Shipment header and movement lifecycle over stable Party,
Location, and Route IDs. It does not own master identity, route topology,
Planning schedules, Product/material definitions, cargo trading facts,
booking, tracking, compliance, inventory, or intelligence.

Detailed design and delivery evidence:

- `docs/delivery/shipment-support-slice-design-2026-07-17.md`
- `docs/delivery/shipment-support-slice-delivery-2026-07-17.md`

## First Slice

The first slice owns:

- organization-unique immutable Shipment codes;
- required shipper and consignee Party IDs;
- required, distinct origin and destination Location IDs;
- an optional active Route whose governed endpoints must match the Shipment;
- optional planned departure and arrival dates;
- `draft`, `planned`, `in_transit`, `arrived`, `closed`, and `cancelled`
  lifecycle states;
- optimistic version checks and append-only status-transition history;
- tenant-scoped list, detail, status-history, immutable reference, and
  owner-backed option reads;
- a module-owned Shipment Support workbench and candidate verifier.

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/shipments.core/manifest.yaml` |
| Backend behavior and private ORM | `modules/shipments.core/backend/uok_shipments_core` |
| Schema changes | `modules/shipments.core/migrations` |
| Backend and frontend tests | `modules/shipments.core/tests` |
| Candidate verifier | `modules/shipments.core/verify` |
| Production React and CSS | `modules/shipments.core/web/src` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The facade exports only the frozen `ShipmentReferenceDTO`,
`resolve_shipment_reference`, and four runtime-composition hooks. All ORM
mappings, services, owner gateways, request schemas, and HTTP adapters remain
private.

## Data And Integrity Rules

- Every Shipment and status-history row belongs to exactly one organization.
- Codes are normalized, immutable, and unique only within one organization.
- Party, Location, and Route references are bounded stable IDs, not foreign
  feature keys, copied master values, ORM relationships, or cross-owner joins.
- New references resolve through exact named owner facade functions and must be
  active, visible, and in the same tenant.
- A selected Route's first and last Location IDs must match the Shipment
  origin and destination.
- Header updates are limited to `draft` and `planned`; lifecycle transitions
  follow the one-way state machine and require a non-empty reason.
- Closed and cancelled Shipments remain valid historical public references.
- All reads and writes enforce actor organization, permission, module
  operational state, and optimistic version.

## Public And UI Contracts

- List API: `/api/shipments/records`
- Detail API: `/api/shipments/records/{shipment_id}`
- Status history: `/api/shipments/records/{shipment_id}/status-history`
- Party resolution: `/api/shipments/party-references/{party_id}`
- Location choices: `/api/shipments/location-options`
- Route choices: `/api/shipments/route-options`
- Commands: `CreateShipment`, `UpdateShipment`,
  `TransitionShipmentStatus`
- Permissions: `shipments.read`, `shipments.manage`
- Workbench section: `shipments`

## Non-Goals

Carrier/booking/rate/tracking integrations, compliance documents, cargo or
Product lines, quantities, title/pricing/payment, inventory/WMS, customs,
persisted legs, route optimization, Planning redesign, intelligence scoring,
hard delete, module splits, Kernel growth, and shell-contract changes.

## Qualification

Before promotion:

```powershell
python -m pytest -q -p no:cacheprovider modules/shipments.core/tests --ignore=modules/shipments.core/tests/web
python -m pytest -q -p no:cacheprovider tests/test_shipment_foreign_data_boundary.py tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Runtime acceptance additionally requires a rebuilt PostgreSQL candidate,
authenticated Shipment verifier evidence, browser proof of the RCN corridor
lifecycle, GitHub preflight/readiness, and green hosted CI at the final PR
head.

## Next Slice Boundary

Shipment support should remain deliberately thin. The next product slice
may add a tenant-scoped Shipment-to-Document-Type requirement link through the
immutable `compliance.core` facade. That link must not add a file vault, block
Shipment movement status, duplicate Compliance metadata, or read Compliance
tables. Any later cargo/Product line belongs to `cargo.transactions` after
Product Master publishes a real immutable reference contract.
