# Shipment Document Instance Metadata Slice Design – 2026-07-17

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Requirement Links And Public APIs

`shipments.core` already owns the tenant-scoped Shipment header, movement lifecycle, and document-requirement links:

- private Shipment and requirement mappings in `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/models.py`;
- migrations `modules/shipments.core/migrations/001_shipments_core.sql` and `002_shipment_document_requirements.sql`;
- requirement commands `AddShipmentDocumentRequirement`, `UpdateShipmentDocumentRequirement`, `SetShipmentDocumentRequirementStatus`, and `RemoveShipmentDocumentRequirement`;
- requirement list, history, and readiness-summary reads under `/api/shipments`;
- DTO-only Compliance resolution in `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/compliance_gateway.py`; and
- an exact six-symbol facade in `modules/shipments.core/backend/uok_shipments_core/public_api.py`.

The Shipment facade remains:

1. `ShipmentReferenceDTO`
2. `resolve_shipment_reference`
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

`compliance.core` owns document-type identity and lifecycle. Its exact immutable boundary is `modules/compliance.core/backend/uok_compliance_core/public_api.py`. This slice needs only:

| Compliance public symbol | Contract used by Shipment |
|---|---|
| `ComplianceDocumentTypeReferenceDTO` | Frozen value data for stable ID, resolution state, code, canonical name, category, lifecycle, and safe status summary |
| `resolve_compliance_document_type_references(db, actor, ids)` | Tenant- and permission-aware resolution of the requested stable IDs |

There is currently no document-instance mapping, metadata lifecycle, history, API, UI, or verifier proof. Requirement readiness is metadata-only and currently changes only through explicit requirement commands.

## 2. Ownership Decision

`shipments.core` owns document-instance metadata.

An instance records operational evidence associated with one Shipment and may satisfy one owner-local requirement link. Its creation, verification, readiness effect, authorization, and retention therefore share the Shipment transaction boundary. `compliance.core` continues to own only the document-type vocabulary.

This decision provides one owner for the current row, history, API, UI, and readiness update:

- no Compliance write into Shipment data;
- no Compliance foreign key, table lookup, join, repository, schema, or ORM import;
- no Party dependency for issuer data; this slice stores bounded free-text `issuing_party_name`;
- no new module, Host adapter, Kernel contract, shell contract, or Python facade symbol; and
- no ownership split that would require a distributed transaction inside the monolith.

## 3. Domain Model, Status Machine, And Requirement Relationship

### ShipmentDocumentInstance

| Field | Rule |
|---|---|
| `id` | Stable generated instance identifier |
| `organization_id` | Mandatory tenant owner derived only from the authenticated actor |
| `shipment_id` | Required owner-local foreign key to `shipments.id` |
| `compliance_document_type_id` | Required bounded stable Compliance ID; text only, with no Compliance foreign key |
| `requirement_id` | Optional immutable, restrictive owner-local foreign key to `shipment_document_requirements.id` |
| `document_number` | Required normalized operational reference, maximum 160 characters |
| `issuing_party_name` | Optional free-text issuer, maximum 240 characters |
| `issued_on` / `expires_on` | Optional dates; expiry cannot precede issue |
| `status` | `draft`, `recorded`, `verified`, `rejected`, or `superseded` |
| `notes` | Optional operational text, maximum 2,000 characters |
| `version` | Independent positive optimistic-concurrency version |
| actor/timestamps | Creator, last updater, created time, and updated time |

Creation starts at `draft`, version `1`. Shipment, Compliance type, and requirement link are immutable after creation. Multiple instances may reference the same type or requirement because replacement and multiple-document evidence are legitimate; there is no artificial uniqueness constraint.

### Status Machine

```text
draft -> recorded | superseded
recorded -> verified | rejected | superseded
rejected -> recorded | superseded
verified -> superseded
superseded -> terminal
```

Metadata edits are allowed only in `draft`, `recorded`, or `rejected`. A same-state or illegal transition fails. There is no delete command; `superseded` is the audit-safe terminal state.

### ShipmentDocumentInstanceHistory

Each create, update, or status transition appends a full owner snapshot with:

- stable instance, Shipment, Compliance type, and optional requirement IDs;
- document number, issuer, dates, status, and notes;
- action `created`, `updated`, or `status_changed`;
- resulting version, reason, actor, and timestamp.

History retains text identifiers and does not depend on a current instance or requirement row for survival. An active requirement linked by retained instance metadata cannot be removed; this prevents a silent unlink without an instance version and history record.

### Explicit Readiness Coupling

If an instance links a requirement, that requirement must belong to the same tenant and Shipment and reference the same Compliance type.

`SetShipmentDocumentInstanceStatus` accepts an explicit `mark_requirement_received` flag plus `expected_requirement_version`. The flag is valid only while moving to `verified` and only for a linked `missing` requirement. In one database transaction, Shipment:

1. locks the same-tenant Shipment, instance, and requirement in stable order;
2. validates both optimistic versions and the type relationship;
3. changes the instance to `verified`;
4. changes the requirement from `missing` to `received`;
5. appends both histories and both correlated domain events; and
6. returns the refreshed instance and requirement snapshot.

The operation never overwrites `waived` or `not_applicable`. Later rejection or supersession does not automatically reverse readiness because another instance or manual evidence may still satisfy the requirement.

## 4. Minimal Public API Symbols

The existing Shipment HTTP and command providers expose the slice without widening the six-symbol Python facade.

### Reads

- `GET /api/shipments/records/{shipment_id}/document-instances`
- `GET /api/shipments/records/{shipment_id}/document-instances/{instance_id}`
- `GET /api/shipments/records/{shipment_id}/document-instances/{instance_id}/history`

Responses are frozen Pydantic DTOs. They omit organization identity and embed resolved Compliance value data, never an ORM object. The instance DTO includes a bounded current requirement snapshot when linked.

### Commands

- `CreateShipmentDocumentInstance`
- `UpdateShipmentDocumentInstance`
- `SetShipmentDocumentInstanceStatus`

Create accepts Shipment ID, Compliance type ID, optional requirement ID, document number, issuer, dates, and notes. Update accepts only editable metadata, exact instance version, and reason. Status change accepts the exact instance version, target status, reason, and the optional explicit requirement-update fields.

All commands use the existing Shipment command provider, `shipments.manage` permission, Host idempotency, and one transaction. No speculative cross-module Python read facade is added because no external module consumes instance metadata in this slice.

## 5. Compliance And Party DTO-Only Calls

| Shipment operation | Public owner call | Purpose |
|---|---|---|
| Create instance | `resolve_compliance_document_type_references(db, actor, (type_id,))` | Accept only an active, tenant-visible type |
| List/detail/history | Same resolver with the stored IDs | Render current immutable code/name/category/lifecycle value data without a join |
| Update/status | No foreign write; resolution only for response rendering | Preserve owner-local mutation and show current type state |
| Party resolution | None | `issuing_party_name` is bounded free text; no new Contacts/Party edge is justified |

Shipment imports only `ComplianceDocumentTypeReferenceDTO` and `resolve_compliance_document_type_references` by name from `uok_compliance_core.public_api`. Denied owner resolution must not echo the stored type ID in actor-facing fields or errors.

## 6. Migration Plan

Add the forward-only owner migration:

`modules/shipments.core/migrations/003_shipment_document_instances.sql`

It creates:

| Table / mapping | Purpose |
|---|---|
| `shipment_document_instances` / `ShipmentDocumentInstance` | Current tenant-owned Shipment document metadata |
| `shipment_document_instance_history` / `ShipmentDocumentInstanceHistory` | Append-only create, update, and lifecycle snapshots |

The migration adds controlled status/action checks, positive versions, date ordering, bounded fields, and tenant-aware indexes for Shipment/status, type, requirement, and history. It may reference only universal Kernel identity tables plus the owner-local Shipment and requirement tables.

`compliance_document_type_id` is plain text. There is no Compliance foreign key or cross-module referential constraint. Host registration remains manifest-driven; the manifest adds exactly two owner mappings, three commands, and three events.

## 7. Tenant Isolation And Authorization

- Every list, detail, history, lock, update, and transition predicate includes `actor.organization_id` and Shipment ID.
- Every operation proves the same-tenant Shipment through owner-local services before accessing the instance.
- Requirement linkage is checked by tenant, Shipment, requirement ID, and matching type.
- Compliance resolution receives the same immutable actor; foreign, unknown, denied, inactive, archived, or unavailable types fail closed.
- Organization identity is never accepted in payloads or exposed in DTOs.
- Reads require `shipments.read`; writes require `shipments.manage`; `shipments.core` must be operational.
- Instance and requirement versions are independent of the Shipment header. Instance operations do not increment the Shipment version.
- Viewer/finance roles may read but receive no mutation controls. Cross-tenant and denied failures use generic messages and do not echo foreign identifiers.
- Frontend request-generation guards discard stale Shipment, tenant, role, selection, and mutation completions.

## 8. UI Surfaces

Extend the existing Shipment detail with a **Document instances** panel adjacent to the existing requirement/readiness panel:

- list resolved type, document number, issuer, dates, instance status, linked requirement, and notes;
- add/edit metadata through `WorkspaceEditorPopup`;
- change lifecycle status through an explicit status editor;
- show **Mark linked requirement received** only for a valid linked missing requirement during verification;
- refresh requirement readiness after a successful coupled verification;
- render read-only data without mutation controls for non-managing roles; and
- display restricted/unavailable types without raw foreign-ID fallback.

The UI uses only Shipment endpoints and `/api/commands`. It imports no Compliance frontend code and makes no `/api/compliance/*` request. There is no file input, drag-and-drop zone, multipart form, preview, download, attachment, thumbnail, blob, or upload control.

## 9. Test Plan

### Unit And Domain

- Strict request schemas, bounded normalized fields, date ordering, frozen DTOs, immutable relationship fields, exact versions, and no-op rejection.
- Creation at draft/version 1, legal and illegal transitions, editable statuses, terminal supersession, complete history, and events.
- Linked requirement matching, explicit missing-to-received coupling, stale requirement version rejection, no overwrite of waiver/not-applicable, and transactional rollback.

### API, Integration, And Tenant Proof

- List/detail/history, active type validation, later type deactivation rendering, idempotent command replay, permission denial, and module disablement.
- Foreign Shipment, type, requirement, and instance denial with identifier redaction.
- Coupled verification updates readiness once, does not advance on replay, and does not increment the Shipment header version.

### Frontend

- List, create, edit, status changes, verification checkbox, readiness refresh, loading/error/401/403, stale session, unmount, read-only role, accessibility labels, responsive reflow, and console cleanliness.
- Assert no Compliance HTTP call and no binary/file/upload API or control.

### Architecture Gates

- Extend `tests/test_shipment_foreign_data_boundary.py` for the existing two-symbol Compliance allowlist and the new instance implementation.
- Fail Shipment imports of Compliance `_internal`, ORM, persistence, repository, schema, migration, table name, raw SQL, join, reflection, or foreign key.
- Add schema/migration/OpenAPI/frontend assertions against binary columns, `storage_key`-style fields, `format: binary`, multipart, file APIs, and preview pipelines.
- Extend exact manifest, model, migration, generated-contract, verifier, documentation, and source-boundary assertions.
- Keep Planning/Contacts facades, Kernel/Host counts, shell contracts, Gap 1–3 tests, and the Shipment six-symbol facade unchanged.

## 10. Freeze Compliance Checklist And Non-Goals

- [x] Business behavior, mappings, migration, read/write services, UI, tests, and verifier remain in `shipments.core`.
- [x] Compliance remains the type owner and is read only through its existing frozen DTO API.
- [x] No Party edge is added.
- [x] No foreign ORM, table, repository, schema, migration, foreign key, join, raw SQL, or copied authoritative value data is designed.
- [x] Host remains bootstrap/DI/ORM registration/auth/composition only.
- [x] Kernel, shell contracts, Planning, Contacts, and module topology are unchanged.
- [x] The Shipment Python facade remains six symbols.
- [x] Requirement readiness coupling is explicit, owner-local, optimistic, atomic, and non-blocking to Shipment movement.
- [x] No binary storage or file-vault behavior exists.

### Non-Goals

- File upload, storage buckets, multipart forms, object-store keys, blobs, binary columns, filenames, MIME metadata, checksums, previews, thumbnails, downloads, virus scanning, or attachment versioning.
- E-signature, notarization, legal hold, OCR, customs/broker fetch, Intelligence/Oracle scoring, or legal-rule decisions.
- Automatic document requirements, hard Shipment workflow blocking, reverse readiness automation, Party master linkage, or cross-module joins.
- Planning/Contacts changes, module split, Kernel growth, Host adapter growth, shell-cycle work, or broad refactoring.

## 11. Manual Demo Script

1. In Compliance Document Types, create or reuse active `BILL-OF-LADING`, `CERTIFICATE-OF-ORIGIN`, and `COMMERCIAL-INVOICE` types.
2. Open the existing Africa-origin to V.O.C./Thoothukudi-style Shipment.
3. Add Commercial Invoice as a required, missing Shipment document requirement.
4. In **Document instances**, create a draft Commercial Invoice with document number, issuer, issue/expiry dates, notes, and the matching requirement link.
5. Edit the metadata and move the instance to `recorded`; confirm readiness remains missing.
6. Move the instance to `verified`, explicitly select **Mark linked requirement received**, and confirm the requirement becomes received and readiness becomes satisfied.
7. Refresh and inspect list, detail, and history; replay does not create another history row or version.
8. Attempt an inactive, unknown, mismatched, or foreign-tenant type/requirement and confirm the operation fails without identifier disclosure.
9. Sign in as a viewer and confirm metadata is readable but mutation controls are absent.
10. Confirm there is no file input, upload action, preview, or storage field anywhere in the workflow.

## 12. Explicit No-Binary Schema Rule

The current and history tables must contain no BLOB, BYTEA, binary, varbinary, file-content, or attachment-content column. Request, response, command, event, OpenAPI, and frontend contracts must contain no required or optional `storage_key`, `object_store_key`, `object_key`, `bucket`, `file_path`, `file_url`, `content_bytes`, `blob`, upload token, or binary payload.

`document_number` is an external business reference, not a storage locator. The slice is complete without any binary asset, file-vault, object-store, multipart, preview, or download infrastructure.
