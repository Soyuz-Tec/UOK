# Shipment Document Requirements Slice Design – 2026-07-17

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Shipment And Compliance Public APIs

`shipments.core` owns the tenant-scoped operational Shipment header and movement lifecycle:

- private mappings `Shipment` and `ShipmentStatusHistory` in `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/models.py`;
- owner migration `modules/shipments.core/migrations/001_shipments_core.sql`;
- commands `CreateShipment`, `UpdateShipment`, and `TransitionShipmentStatus`;
- tenant-scoped list, detail, status-history, Party-reference, Location-option, and Route-option reads under `/api/shipments`;
- a module-owned Shipment Support workbench under `modules/shipments.core/web/src`; and
- an exact six-symbol facade in `modules/shipments.core/backend/uok_shipments_core/public_api.py`.

The six supported Shipment facade symbols remain:

1. `ShipmentReferenceDTO`
2. `resolve_shipment_reference`
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

`compliance.core` owns tenant-specific Compliance Document Type identity and lifecycle:

- private mappings `ComplianceDocumentType` and `ComplianceDocumentTypeNameHistory` in `modules/compliance.core/backend/uok_compliance_core/_internal/persistence/models.py`;
- owner migration `modules/compliance.core/migrations/001_compliance_core.sql`;
- active, inactive, and archived lifecycle states; and
- an exact immutable owner facade in `modules/compliance.core/backend/uok_compliance_core/public_api.py`.

Shipment needs exactly these existing Compliance symbols:

| Compliance public symbol | Contract used by Shipment |
|---|---|
| `ComplianceDocumentTypeReferenceDTO` | Frozen value data: stable ID, resolution status, code, canonical name, category, lifecycle status, and safe status summary |
| `resolve_compliance_document_type_references(db, actor, ids=None)` | Active tenant options when IDs are omitted; ordered, lifecycle-aware resolution for explicit stable IDs |

There is currently no Shipment requirement-link table, command, API, UI, verifier step, or document-instance concept. Compliance deliberately owns no Shipment reference or write path.

## 2. Domain Model And Status Machine

### ShipmentDocumentRequirement

The active link is owned by `shipments.core`:

| Field | Rule |
|---|---|
| `id` | Stable generated link identifier |
| `organization_id` | Mandatory tenant owner derived only from the authenticated actor |
| `shipment_id` | Required same-tenant Shipment ID with an owner-local foreign key to `shipments.id` |
| `compliance_document_type_id` | Required stable Compliance ID stored as bounded text with no Compliance foreign key |
| `requirement_level` | `required` or `optional` |
| `status` | `missing`, `received`, `waived`, or `not_applicable` |
| `notes` | Optional operational text, maximum 2,000 characters |
| `version` | Independent positive optimistic-concurrency version |
| actor/timestamps | Creator, last updater, created/updated time |

The tuple `(organization_id, shipment_id, compliance_document_type_id)` is unique while the link exists. Add always starts at `missing`, version `1`. The Compliance type ID is immutable; changing the type means remove the old link and add a new one.

Requirement status is deliberately not a Shipment workflow gate. Any status may change to any different status when the caller supplies the exact expected version and a non-empty reason. This permits correction of operational metadata without introducing a rules engine. A same-state transition is rejected.

### ShipmentDocumentRequirementHistory

An append-only owner history row is written for add, update, status change, and remove. It stores:

- tenant and same-owner Shipment ID;
- stable requirement and Compliance type IDs;
- action: `added`, `updated`, `status_changed`, or `removed`;
- the resulting level, status, notes, version, reason, actor, and timestamp.

History has an owner-local foreign key to Shipment but deliberately no foreign key to the current requirement row. A version-checked remove deletes the active link after writing its final history snapshot and correlated event, so audit survives and the same type can later be re-added as a new link.

### Non-Blocking Summary

The owner read model returns factual counts only:

- `required_total`
- `required_satisfied`
- `required_missing`
- `required_received`
- `required_waived`
- `required_not_applicable`
- `optional_total`

`required_satisfied` is the arithmetic sum of required `received`, `waived`, and `not_applicable` links. It is informational and does not permit or block a Shipment status transition.

## 3. Why Shipments Owns The Links

Applicability and satisfaction belong to one operational Shipment, not to global Compliance type identity. Two Shipments in the same tenant may require different types, requirement levels, notes, and satisfaction states even though both reference the same governed Compliance Document Type.

Therefore:

- `shipments.core` owns the link aggregate, mutation authorization, history, summary, APIs, UI, and retention;
- `compliance.core` remains the sole owner of type code, name, category, and lifecycle;
- Compliance never writes Shipment tables;
- Shipment stores only the stable Compliance ID and never copies authoritative type metadata; and
- later Intelligence may consume a real Shipment owner contract, but it must not query either owner's tables.

This is a cohesive second aggregate inside the existing Shipment business capability. It does not justify a module split because it shares the Shipment tenant, permission, lifecycle context, UI, verifier, and transaction boundary.

## 4. Exact Compliance Public API Functions And DTOs Used

Add `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/compliance_gateway.py` with named imports only:

```python
from uok_compliance_core.public_api import (
    ComplianceDocumentTypeReferenceDTO,
    resolve_compliance_document_type_references,
)
```

| Shipment operation | Compliance call | Rule |
|---|---|---|
| Document-type options | `resolve_compliance_document_type_references(db, actor)` | Returns active, tenant-visible value options only |
| Add requirement | Resolver with the one requested stable ID | Accept only `status == "ready"`; reject inactive, archived, unknown, foreign-tenant, denied, or unavailable |
| List/history rendering | Resolver with all stored stable IDs | Preserve request order and render current code/name/category/lifecycle value data without a join |
| Update/status/remove | No type rewrite | Operate on the existing same-tenant Shipment-owned link even if its type later becomes inactive, while reads show the current `unavailable` owner state |

Shipment must not import `uok_compliance_core` as a module object, `api_router`, `_internal`, models, repositories, schemas, migrations, or infrastructure. It must not mention Compliance table names in SQL, mappings, foreign keys, joins, reflection, or metadata access.

Denied Compliance resolutions do not expose the stored type ID in actor-facing response data or UI fallback text.

## 5. Minimal Shipments Public API Additions

The owner HTTP and command contracts are the public surface for this slice:

### Reads

- `GET /api/shipments/document-type-options`
- `GET /api/shipments/records/{shipment_id}/document-requirements`
- `GET /api/shipments/records/{shipment_id}/document-requirements/{requirement_id}/history`

The requirement-list response contains frozen/serialization-safe Shipment-owned DTOs plus the non-blocking summary. It exposes resolved Compliance value data, not a Compliance ORM object.

### Commands

- `AddShipmentDocumentRequirement`
- `UpdateShipmentDocumentRequirement`
- `SetShipmentDocumentRequirementStatus`
- `RemoveShipmentDocumentRequirement`

All four use the existing Shipment command-provider facade and `shipments.manage` permission. Update, status, and remove require `shipment_id`, the stable requirement ID, `expected_version`, and a reason. Update can change only requirement level and notes. Add requires Shipment ID, Compliance type ID, level, and optional notes.

The Python facade stays at six symbols. There is no external Python consumer of requirement data in this slice, so adding a speculative readiness DTO would violate the freeze's real-caller rule. A later Intelligence slice must add its own immutable Shipment summary contract only when that caller exists and must update exact facade tests and documentation.

## 6. Migration Plan

Add the forward-only owner migration:

`modules/shipments.core/migrations/002_shipment_document_requirements.sql`

It creates only:

| Table / mapping | Purpose |
|---|---|
| `shipment_document_requirements` / `ShipmentDocumentRequirement` | Current tenant-owned Shipment/type applicability and satisfaction state |
| `shipment_document_requirement_history` / `ShipmentDocumentRequirementHistory` | Append-only snapshots for add, update, status change, and remove |

Integrity includes tenant/Shipment/type uniqueness, controlled level/status/action checks, positive versions, bounded notes/reasons, and tenant/Shipment/status/type/history indexes. Universal organization/user keys and owner-local Shipment keys are allowed. There is no reference to `compliance_document_types` or any other feature table.

The existing `001_shipments_core.sql` remains unchanged. The Host continues manifest-driven ORM registration, so the two new mappings and the additive SQL definition must match exactly. Model-registry, migration-ownership, manifest, metadata-fixture, and physical-boundary expectations must move from 60 to 62 composed mappings.

## 7. Tenant Isolation And Authorization

- Every requirement list, history, lock, update, status, and remove predicate includes `actor.organization_id` and Shipment ID.
- Every read first proves the same-tenant Shipment through the Shipment owner read service.
- Organization identity is never accepted in request payloads or exposed in response DTOs.
- Reads require `shipments.read`; writes require `shipments.manage`; `shipments.core` must be operational.
- Compliance resolution receives the same immutable actor, so foreign-tenant IDs resolve as missing/denied and cannot be added.
- Requirement versions are independent of Shipment header versions. Requirement mutations do not increment the Shipment version.
- A Shipment status transition remains legal even when required items are missing. This slice is evidence tracking, not enforcement.
- A viewer or finance manager may read the panel but receives no mutation controls. Cross-tenant detail, history, add, update, status, and remove attempts fail without disclosing the foreign record.
- Request-generation guards discard stale list, selection, tenant, role, and mutation completions in the module UI.

## 8. UI Surface

Extend the existing module-owned Shipment detail only:

- a **Document requirements** panel after Shipment facts/actions and before movement history;
- a server-owned summary such as `2 required · 1 received · 1 waived · 0 missing`;
- resolved Compliance code, canonical name, category, lifecycle warning, requirement level, status, and notes per row;
- **Add requirement**, **Edit**, **Set status**, and confirmed **Remove** controls for managing roles;
- a `WorkspaceEditorPopup` for active document-type selection, level, and notes;
- explicit unavailable/restricted copy with no raw foreign ID fallback; and
- read-only rendering for viewer and finance roles.

The frontend calls only Shipment endpoints and the normal `/api/commands` transport. It must not import Compliance frontend source or call `/api/compliance/*`. All new code and CSS live under `modules/shipments.core/web/src`, use existing neutral host/shared contracts and semantic tokens, and remain composed through the unchanged Shipment `moduleSurface.tsx`.

There are no upload, attachment, preview, file, blob, binary, or e-signature controls.

## 9. Test Plan

### Unit And Domain

- Validate controlled levels/statuses, notes/reason bounds, strict extra-field rejection, immutable type ID, expected versions, no-op rejection, and frozen response DTOs.
- Prove add starts missing/version 1; update changes level/notes; any distinct status correction is audited; remove preserves history/evidence; and re-add creates a new stable link.
- Prove summaries for required/optional, missing, received, waived, and not-applicable states.

### API And Integration

- Prove add/update/status/remove idempotency, same-tenant locks, expected-version conflicts, permission denial, module disablement, and correlated events.
- Prove active Compliance choices, inactive/archived/unknown rejection on add, later owner deactivation rendering, denied-ID redaction, and zero copied type metadata.
- Prove missing required items do not block Shipment `draft -> planned`.

### Tenant Isolation

- Reuse one Compliance type code in two tenants and reject the foreign stable ID.
- Reject foreign Shipment and requirement IDs for list, history, update, status, and remove.
- Prove response DTOs contain no organization identity and denied owner IDs are absent.

### Frontend

- Render server summary, resolved types, lifecycle warnings, statuses, notes, and read-only states.
- Prove add, edit, received, waived, not-applicable, remove, error, loading, 401/403, and stale-session behavior.
- Assert the module makes no Compliance HTTP call and renders no upload/file control.
- Verify keyboard labels, focus, semantic status text, desktop and 375-pixel reflow, and console cleanliness.

### Architecture Gates

- Extend `tests/test_shipment_foreign_data_boundary.py` so Shipment may import only the two exact Compliance facade symbols.
- Keep Compliance ORM/table/schema/repository, broad facade, dynamic import, raw SQL, reflection, metadata, join, and foreign-key bypasses failing.
- Extend exact manifest, command/event, model registry, migration ownership, physical boundary, generated contract, frontend catalog, verifier, and documentation gates.
- Keep `tests/test_planning_data_boundary.py`, Planning/Contacts public-facade counts, Kernel/Host adapter counts, shell cycles, and every Gap 1–3 architecture test unchanged in intent and green.

## 10. Architecture Freeze Checklist And Non-Goals

- [x] Feature behavior, mappings, migration, commands, reads, UI, tests, and verifier stay inside `shipments.core`.
- [x] Compliance remains the sole type owner and is consumed only through its existing immutable public DTO resolver.
- [x] `compliance.core` becomes a declared Shipment dependency; the direction is acyclic because Compliance has no feature dependency.
- [x] No Compliance ORM/table/join/key, copied metadata, or write path is designed.
- [x] The existing Shipment HTTP adapter is reused; Host stays at 17 adapters and 37 exact imports.
- [x] Kernel, shell contracts, Planning, and Contacts receive no new behavior or public surface.
- [x] The Shipment Python facade remains six symbols until a real external Python caller exists.
- [x] Shipment movement lifecycle remains non-blocking.
- [x] New exact cross-owner enforcement and all frozen architecture gates remain mandatory.

### Non-Goals

- File upload/storage, object storage, blobs, binary versioning, preview, download, e-signature, OCR, or document vault behavior.
- Compliance document-instance metadata, expiry, issuer, reference number, or validation of an actual document.
- Automatic requirement policies, jurisdiction/corridor rules, auto-seeding, multiplicity rules, customs/broker integrations, or legal decisions.
- Blocking Shipment status transitions, rewriting Shipment lifecycle, Planning readiness integration, or Intelligence/Oracle scoring.
- Compliance writes to Shipment tables, cross-module joins, Product/Party/Route expansion, module split, Kernel growth, Host adapter growth, shell contract changes, or broad refactors.

## 11. Manual Demo Script

1. In Compliance Document Types, create or reuse active tenant-reviewed `BILL-OF-LADING` and `CERTIFICATE-OF-ORIGIN` types.
2. Open the existing Africa-origin to V.O.C./Thoothukudi-style Shipment in Shipment Support.
3. In **Document requirements**, add Bill of Lading as required and Certificate of Origin as optional; confirm both start `missing`.
4. Edit Certificate of Origin to required with a note and verify the summary becomes two required and two missing.
5. Move the Shipment from `draft` to `planned` while both requirements are missing, proving the panel is non-blocking.
6. Mark Bill of Lading `received` and Certificate of Origin `waived`, supplying reasons; confirm the summary shows two satisfied and zero missing.
7. Remove the waived link with a reason and confirm the current list/summary updates while owner history and events remain.
8. Deactivate the removed Compliance type, then prove it cannot be added again; prove an unknown type also fails closed.
9. Sign in as a viewer and confirm all requirement data is readable but mutation controls are absent.
10. Sign in under another tenant and confirm the Shipment and its requirement links are absent.

## Validation

Acceptance requires owner backend/frontend suites, Shipment-to-Compliance exact-boundary tests, all frozen architecture gates, generated-contract checks, TechnologyAudit, EngineeringEvidence, Audit, a rebuilt PostgreSQL candidate, full Verify, authenticated Shipment verifier evidence, browser proof at desktop and 375 pixels, GitHub preflight/readiness, a stacked draft pull request, and green hosted CI at the final head.
