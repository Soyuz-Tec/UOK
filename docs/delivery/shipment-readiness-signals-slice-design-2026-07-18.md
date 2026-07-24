# Shipment Readiness Signals Slice Design – 2026-07-18

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Shipment Readiness Facts

`shipments.core` already owns every authoritative fact needed for a first
advisory readiness view:

- tenant-scoped Shipment identity and movement lifecycle in
  `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/models.py`;
- required and optional Document Type links with `missing`, `received`,
  `waived`, and `not_applicable` states;
- the owner rule that `required_satisfied` is `received + waived +
  not_applicable` in
  `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_read_service.py`;
- document-instance metadata with `draft`, `recorded`, `verified`, `rejected`,
  and `superseded` states in
  `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/document_instance_models.py`;
- append-only Shipment, requirement, and document-instance history; and
- a six-symbol immutable/reference facade in
  `modules/shipments.core/backend/uok_shipments_core/public_api.py`.

The completed metadata delivery record at
`docs/delivery/shipment-document-instance-metadata-slice-delivery-2026-07-17.md`
selects a thin Intelligence readiness signal as the next slice, but correctly
defers the Shipment summary facade until that real caller exists.

No `intelligence.core` or Oracle module, API, migration, package, test, verifier,
or frontend surface exists. Contacts business-intelligence profiles are
Contacts-derived and owner-local. Planning readiness is project/task scheduling
readiness. Reports owns artifacts, while `agents.core` remains an inert
governed-runbook scaffold.

## 2. Gap

Operators can inspect requirements and document instances inside one Shipment,
but they cannot scan all tenant-visible Shipments for:

- missing required Document Types;
- rejected document metadata that needs review;
- Shipments whose requirements have not been defined; or
- Shipments whose required document state is currently satisfied.

Embedding this interpretation back into `shipments.core` would mix operational
record ownership with a cross-record Intelligence capability. Reusing
`agents.core` would mix deterministic business signals with future AI-runbook
governance.

## 3. Chosen Slice

Create a read-only `intelligence.core` capability that presents deterministic,
tenant-scoped Shipment readiness signals.

This is the smallest valuable next slice because it:

1. consumes facts that are now stable after Shipment requirements and
   document-instance metadata;
2. gives operators an immediate exception-oriented worklist;
3. creates the first real caller that justifies a narrow Shipment readiness
   facade;
4. remains advisory and cannot block or mutate Shipment movement; and
5. can later be transported out of process by replacing one owner API adapter,
   without rewriting either domain.

The technical module name is `intelligence.core`. “Oracle” is not used in the
module identity or API because this increment contains no model, probability,
forecast, confidence, or vendor runtime.

## 4. Ownership And Module Shape

`intelligence.core` owns:

- deterministic signal derivation and human-readable reason codes;
- `/api/intelligence/shipment-readiness`;
- the read-only Shipment Readiness workbench;
- `intelligence.read` role grants;
- owner-local tests and candidate verifier; and
- its design, module plan, and delivery evidence.

`shipments.core` continues to own every source fact, row, history, lifecycle
rule, and tenant decision.

The new capability is intentionally stateless:

- no ORM mapping or `model_exports`;
- no SQL migration;
- no owned table, cache, snapshot, command, or event;
- no write permission; and
- no reverse dependency from Shipment.

`modules/intelligence.core/migrations/README.md` records that the empty
migration path is intentional.

## 5. Minimal Shipment Public Facade Addition

The real Intelligence caller justifies widening the Shipment facade from six to
eight exact symbols:

1. frozen `ShipmentReadinessSnapshotDTO`;
2. `resolve_shipment_readiness_snapshots(db, actor, shipment_ids=None)`.

The DTO exposes only owner value data:

| Field group | Value |
|---|---|
| Resolution | `shipment_id`, `status`, `status_summary` |
| Identity/context | `code`, `lifecycle_status`, authorized `open_path` |
| Requirement facts | total, satisfied, missing, received, waived, not-applicable, optional total |
| Instance facts | total, draft, recorded, verified, rejected, superseded |

For a denied, missing, or unavailable resolution, all identity, navigation, and
count fields are `None`. Zero is reserved for an authorized existing Shipment
that truly has no matching rows.

`shipment_ids=None` lists tenant-visible Shipments in deterministic order.
Explicit IDs preserve request order and duplicates and return redacted
per-identifier resolution envelopes. The function:

- requires `shipments.read`;
- checks that `shipments.core` is operational;
- scopes every Shipment-owned query by `actor.organization_id`;
- queries only `shipments`, `shipment_document_requirements`, and
  `shipment_document_instances`;
- makes no Compliance, Party, Location, Route, Planning, or Reports call; and
- exposes no ORM object, requirement/instance/type ID, document number, issuer,
  note, or Intelligence interpretation.

Planning's existing Shipment allowlist remains limited to
`ShipmentReferenceDTO` and `resolve_shipment_reference`.

## 6. Deterministic Advisory Rules

`intelligence.core` derives one band per resolved Shipment:

| Band | Exact rule |
|---|---|
| `attention_required` | `required_missing > 0` or `document_instance_rejected > 0` |
| `not_assessed` | Otherwise, `required_total == 0` |
| `ready` | Otherwise |

Fixed reason codes explain the result:

- `required_documents_missing`;
- `rejected_document_present`;
- `requirements_not_defined`;
- `required_documents_satisfied`;
- `document_metadata_pending_review`; and
- `verified_document_present`.

Draft, recorded, verified, and superseded counts are explanatory. Shipment
`closed` or `cancelled` lifecycle remains context and does not silently override
the tenant's explicit waived/not-applicable decisions.

The signal is current advisory interpretation, not a second source of truth. It
does not change Shipment status, requirement status, document-instance status,
or any version. Shipment histories remain the audit record.

Expiry and “expiring soon” are deferred. A correct rule requires an explicit
as-of date, tenant time-zone policy, and reviewed horizon; this slice must not
hide `today()` or an arbitrary threshold inside the first contract.

## 7. Public HTTP And UI Surface

### HTTP

`GET /api/intelligence/shipment-readiness`

The immutable response contains source status, a tenant-scoped list of derived
signals, owner counts, reason codes, and the owner-authorized Shipment open
path. It contains no organization ID or foreign-owner object.

The adapter requires `intelligence.read`, verifies `intelligence.core` is
operational, and then calls the Shipment facade once. Source denial or
unavailability fails closed and is never rendered as `not_assessed`.

### Workbench

The module-owned React surface provides:

- search by Shipment code;
- band filter for all, attention required, not assessed, and ready;
- Refresh;
- a resizable table with Shipment, lifecycle, readiness, and missing-required
  facts;
- a selected-row detail pane with accessible status text, counts, and reasons;
  and
- an **Open Shipment** link only when the owner supplied a safe path.

There is no editor, command, primary create action, score chart, file control,
or Shipment frontend import. The frontend calls only `/api/intelligence`.
Composition uses the existing neutral module-surface host contract and shared
workspace primitives.

## 8. Tenant Isolation And Authorization

- Intelligence reads require `intelligence.read`.
- Shipment independently enforces `shipments.read`.
- Both module operational states are checked.
- Every owner query is filtered by the actor organization.
- Foreign-tenant Shipments never enter list mode.
- Explicit denied, missing, and unavailable resolutions contain no code,
  lifecycle, open path, or counts.
- Intelligence never amplifies Shipment visibility or echoes rejected
  identifiers in actor-facing errors.
- Standard viewer and finance roles receive read-only signals; no role receives
  an Intelligence write permission.

## 9. Boundary Enforcement

Add `tests/test_intelligence_shipment_data_boundary.py` and support helpers that:

- allow only `ShipmentReadinessSnapshotDTO` and
  `resolve_shipment_readiness_snapshots` from
  `uok_shipments_core.public_api`;
- reject facade module objects, star imports, unknown symbols, dynamic imports,
  Shipment `_internal`, ORM, schemas, repositories, services, and migrations;
- reject Shipment table tokens, raw SQL, joins, reflection, metadata access,
  and foreign keys;
- reject Intelligence imports of Compliance, Contacts, Location, Route,
  Planning, Product, Reports, or Agents;
- reject a reverse Shipment-to-Intelligence import;
- reject Intelligence frontend calls to `/api/shipments` or imports from the
  Shipment frontend; and
- assert no Intelligence SQL migration, mapping, command, event, or owned
  table.

Generic public-facade, Host adapter, shell-cycle, manifest, physical-boundary,
generated-catalog, and candidate-verifier gates are extended without weakening
Gap 1–3 enforcement.

The new HTTP adapter adds only `get_db` and `current_actor` to ADR-0028's exact
allowlist: 18 HTTP adapters and 39 exact Host imports. Kernel, Host source,
command transport, shell contract, Planning, and Contacts remain unchanged.

## 10. Test And Verifier Plan

### Shipment owner contract

- frozen DTO and exact eight-symbol facade;
- authoritative mixed requirement and instance counts;
- authorized zero-state versus unresolved `None`;
- deterministic list and explicit-ID order;
- tenant, permission, missing, and disabled-provider redaction;
- no dependency on Compliance read permission; and
- no owner-computed score or signal.

### Intelligence owner

- pure derivation for attention, not assessed, and ready;
- multiple explanatory reason codes;
- immutable HTTP responses;
- same-tenant list, foreign-tenant exclusion, viewer access, 403, 401, and
  disabled-module behavior;
- advisory-only proof that Shipment lifecycle and version do not change; and
- source denied/unavailable fail-closed behavior.

### Frontend

- loading, empty, error, 401, 403, and disabled states;
- list/detail, search, band filter, keyboard selection, Refresh, and host
  refresh revision;
- stale token/tenant/unmount completion guards;
- safe Open Shipment link;
- no mutation controls or foreign API calls;
- accessible names and non-color status meaning; and
- desktop and narrow responsive layout.

### Candidate verifier

The owner-local verifier installs `intelligence.core`, reads the Shipment
candidate created by the dependency verifier, adds a missing required type
through the Shipment public HTTP/command contract, proves
`attention_required`, marks it received, proves `ready`, and confirms the
Shipment lifecycle/version are unchanged. It also proves viewer access,
and disabled-module failure. Owner integration tests prove tenant-safe absence
with independently provisioned organizations.

## 11. Freeze Compliance Checklist And Non-Goals

- [x] New behavior lives in one capability owner.
- [x] Shipment facts cross only an immutable public facade.
- [x] No foreign ORM, table, repository, schema, FK, join, or raw SQL.
- [x] No Host business logic or Kernel growth.
- [x] No Planning/Contacts facade change.
- [x] No shell/module cycle or frontend facade bypass.
- [x] No persistence, cache, command, event, or workflow mutation.
- [x] No model score, confidence, prediction, or hidden decision.

### Non-goals

- Shipment status blocking or automated requirement/document mutation.
- Expiry/expiring-soon policy, route risk, ETA, anomaly detection, forecasting,
  optimization, or recommendations.
- ML/LLM inference, Oracle runtime/model naming, confidence, probability, or
  legal/compliance decision.
- Notifications, scheduled evaluation, persisted signal history, cache, report
  artifact, or data warehouse.
- File/binary storage, customs/broker integration, Planning/Contacts changes,
  module split, Kernel growth, or shell restructuring.

## 12. Manual Demo Script

1. Complete the existing Compliance, Shipment, requirement, and document
   metadata demo flow.
2. Open **Shipment Readiness**.
3. Confirm the Africa-to-V.O.C./Thoothukudi-style Shipment appears with its
   current lifecycle and owner counts.
4. Add a missing required Document Type to that Shipment.
5. Refresh Intelligence and confirm `attention_required` plus the exact missing
   reason/count.
6. Mark the requirement received through Shipment Support.
7. Refresh Intelligence and confirm the same Shipment becomes `ready` without
   any Shipment lifecycle or header-version change.
8. Select another Shipment with no required links and confirm `not_assessed`.
9. Use search and band filters, open the safe Shipment link, and verify viewer
   read-only behavior.
10. Confirm there is no score, prediction, workflow command, file control, or
    direct Shipment/Compliance data access in the Intelligence surface.
