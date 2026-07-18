# Shipment Support Module Plan

**Module:** `shipments.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/shipments.core`

## Purpose And Authority

`shipments.core` is the optional operational Shipment owner. It governs a
tenant-scoped Shipment header and movement lifecycle over stable Party,
Location, and Route IDs, plus Shipment-specific Document Type applicability
and satisfaction metadata and non-binary compliance document-instance
metadata. It does not own master identity, route topology, Compliance Document
Type vocabulary, document files/binaries, Planning schedules, Product/material
definitions, cargo trading facts, booking, tracking, inventory, or
intelligence.

Detailed design and delivery evidence:

- `docs/delivery/shipment-support-slice-design-2026-07-17.md`
- `docs/delivery/shipment-support-slice-delivery-2026-07-17.md`
- `docs/delivery/shipment-document-requirements-slice-design-2026-07-17.md`
- `docs/delivery/shipment-document-requirements-slice-delivery-2026-07-17.md`
- `docs/delivery/shipment-document-instance-metadata-slice-design-2026-07-17.md`
- `docs/delivery/shipment-document-instance-metadata-slice-delivery-2026-07-17.md`

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

## Document Requirements Slice

The next approved slice remains inside the Shipment capability and owns:

- tenant-scoped links from a Shipment to stable Compliance Document Type IDs;
- `required` and `optional` applicability plus `missing`, `received`, `waived`,
  and `not_applicable` satisfaction metadata;
- independent optimistic versions and append-only add, update, status-change,
  and remove history;
- informational required/received/waived/missing counts that never block a
  Shipment movement-status transition;
- tenant-scoped list, history, add, update, status, and remove contracts; and
- a detail-panel extension with no upload, preview, file, blob, or binary
  control.

Compliance type code, name, category, and lifecycle remain value data resolved
through `ComplianceDocumentTypeReferenceDTO` and
`resolve_compliance_document_type_references`. Shipment stores no copied type
metadata and never reads a Compliance mapping, repository, table, or schema.

## Document Instance Metadata Slice

The document-instance slice also remains inside the Shipment capability and
owns:

- tenant-scoped document-instance metadata linked to one Shipment and one
  stable Compliance Document Type ID;
- an optional owner-local Requirement link, validated for the same tenant,
  Shipment, and Document Type;
- bounded document number, issuer text, issue/expiry dates, notes, optimistic
  version, and `draft`, `recorded`, `verified`, `rejected`, or `superseded`
  status;
- append-only create, update, and status-change history;
- an explicit verified-instance option that may change a still-missing linked
  requirement to `received` in the same Shipment-owned transaction; and
- list, detail, history, create, update, and status contracts plus Shipment
  detail UI without a file input or upload path.

The current and history mappings contain no blob/binary column, file path,
file name, URL, bucket, object-store key, or content bytes. The HTTP contract
contains no multipart or binary schema, and the UI contains no `FormData`,
`FileReader`, object-URL preview, or file control.

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

The facade remains exactly six symbols: the frozen `ShipmentReferenceDTO`,
`resolve_shipment_reference`, and four runtime-composition hooks. Requirement
reads and commands use the existing HTTP/router and command-provider hooks;
there is no speculative cross-module Shipment readiness DTO. All ORM mappings,
services, owner gateways, request schemas, and HTTP adapters remain private.

## Data And Integrity Rules

- Every Shipment, status-history, requirement-link, and requirement-history row
  belongs to exactly one organization.
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
- Each active requirement link stores only one stable Compliance Document Type
  ID and has no Compliance foreign key or cross-owner join.
- Each document instance stores only a stable Compliance Document Type ID and
  has no Compliance foreign key or cross-owner join. Its optional Requirement
  foreign key is owner-local to `shipment_document_requirements`.
- Adding a link requires an active same-tenant type resolved through the exact
  Compliance immutable public facade. Existing links remain auditable if that
  owner later deactivates or archives the type.
- Creating an instance also requires an active same-tenant type through the
  exact Compliance immutable facade. Requirement/type association is immutable
  after creation; a referenced Requirement cannot be removed, and mutable
  instance metadata is limited to nonterminal states.
- Requirement status is informational only. Missing requirements do not block
  any otherwise-valid Shipment movement transition.
- All reads and writes enforce actor organization, permission, module
  operational state, and optimistic version.

## Public And UI Contracts

- List API: `/api/shipments/records`
- Detail API: `/api/shipments/records/{shipment_id}`
- Status history: `/api/shipments/records/{shipment_id}/status-history`
- Party resolution: `/api/shipments/party-references/{party_id}`
- Location choices: `/api/shipments/location-options`
- Route choices: `/api/shipments/route-options`
- Document Type choices: `/api/shipments/document-type-options`
- Requirement list:
  `/api/shipments/records/{shipment_id}/document-requirements`
- Requirement history:
  `/api/shipments/records/{shipment_id}/document-requirements/{requirement_id}/history`
- Document instance list:
  `/api/shipments/records/{shipment_id}/document-instances`
- Document instance detail:
  `/api/shipments/records/{shipment_id}/document-instances/{instance_id}`
- Document instance history:
  `/api/shipments/records/{shipment_id}/document-instances/{instance_id}/history`
- Commands: `CreateShipment`, `UpdateShipment`,
  `TransitionShipmentStatus`, `AddShipmentDocumentRequirement`,
  `UpdateShipmentDocumentRequirement`,
  `SetShipmentDocumentRequirementStatus`, and
  `RemoveShipmentDocumentRequirement`,
  `CreateShipmentDocumentInstance`, `UpdateShipmentDocumentInstance`, and
  `SetShipmentDocumentInstanceStatus`
- Permissions: `shipments.read`, `shipments.manage`
- Workbench section: `shipments`

## Non-Goals

Carrier/booking/rate/tracking integrations, Compliance type ownership,
document files/uploads/blobs/object-store keys/previews, commercial document
content, requirement policy or workflow blocking, cargo or Product lines,
quantities, title/pricing/payment,
inventory/WMS, customs, persisted legs, route optimization, Planning redesign,
intelligence scoring, module splits, Kernel growth, and shell-contract changes.

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
lifecycle and requirement metadata flow, GitHub preflight/readiness, and green
hosted CI at the final PR head.

## Next Slice Boundary

Shipment support should remain deliberately thin. After the document-instance
metadata slice is qualified, evidence may justify a thin Intelligence
readiness signal consuming a real future Shipment immutable summary contract,
or bounded operational polish. Any later cargo/Product line belongs to
`cargo.transactions` after Product Master publishes a real immutable reference
contract.
