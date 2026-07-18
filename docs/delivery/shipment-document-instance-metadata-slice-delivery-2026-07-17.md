# Shipment Document Instance Metadata Slice Delivery – 2026-07-17

**Status:** Implementation and rebuilt-candidate qualification complete; draft PR `#68` is open with code-bearing hosted CI green.

**Candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/shipment-document-instance-metadata-slice-design-2026-07-17.md`

## What Shipped

`shipments.core` now owns tenant-scoped compliance document-instance metadata associated with one Shipment and, optionally, one Shipment-owned requirement. Operators can:

- create a `draft` instance for an active tenant-visible Compliance Document Type;
- record a bounded document number, free-text issuer, issue/expiry dates, and operational notes;
- edit metadata while the instance is `draft`, `recorded`, or `rejected`;
- move the instance through `draft`, `recorded`, `verified`, `rejected`, and terminal `superseded` states;
- explicitly mark a linked missing requirement `received` in the same transaction when verifying an instance; and
- read the current list, detail, and append-only history.

The Shipment detail workbench now composes **Document requirements** and **Document instances** as one owner-local evidence surface. It supports list, create, edit, status change, read-only roles, optimistic versions, stale-session guards, and readiness refresh after coupled verification.

## Data And Migration

The forward-only owner migration is:

- `modules/shipments.core/migrations/003_shipment_document_instances.sql`

It creates:

| Shipment-owned mapping | Table | Purpose |
|---|---|---|
| `ShipmentDocumentInstance` | `shipment_document_instances` | Current bounded metadata, lifecycle, owner-local references, version, actor, and timestamps |
| `ShipmentDocumentInstanceHistory` | `shipment_document_instance_history` | Append-only full snapshots for create, update, and status change |

The optional Requirement foreign key is restrictive and owner-local to `shipment_document_requirements.id`. Requirement association is immutable after create, and an active linked requirement cannot be removed while retained instance metadata references it. History keeps stable text identifiers and no foreign key to the current instance or requirement row.

`compliance_document_type_id` is bounded text with no Compliance foreign key, ORM relationship, table access, copied master value, or cross-owner join. The runtime now composes 55 feature mappings plus nine Kernel mappings, 64 total.

## Public API Surface

### Shipment reads

- `GET /api/shipments/records/{shipment_id}/document-instances`
- `GET /api/shipments/records/{shipment_id}/document-instances/{instance_id}`
- `GET /api/shipments/records/{shipment_id}/document-instances/{instance_id}/history`

The actor-facing immutable DTO contains Shipment-owned metadata, a resolved immutable Compliance value reference, and an optional current requirement snapshot with ID, level, status, and version. It excludes organization identity and redacts the stored Compliance type ID when the owner reference is denied.

### Shipment commands

- `CreateShipmentDocumentInstance`
- `UpdateShipmentDocumentInstance`
- `SetShipmentDocumentInstanceStatus`

All three use `shipments.manage`, the existing Host command transport and idempotency log, exact optimistic versions, and correlated Shipment-owned events:

- `ShipmentDocumentInstanceCreated`
- `ShipmentDocumentInstanceUpdated`
- `ShipmentDocumentInstanceStatusChanged`

The Python facade remains exactly six symbols in `modules/shipments.core/backend/uok_shipments_core/public_api.py`. No speculative external instance/readiness symbol was added.

## Compliance Via Immutable DTO Proof

Shipment continues to import only these exact owner symbols through `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/compliance_gateway.py`:

```python
from uok_compliance_core.public_api import (
    ComplianceDocumentTypeReferenceDTO,
    resolve_compliance_document_type_references,
)
```

Create accepts only `status == "ready"`. Unknown, inactive, archived, unavailable, denied, or foreign-tenant type IDs fail closed. Reads resolve the current code, canonical name, category, and lifecycle through that DTO contract without a join.

Enforcement in `tests/shipment_foreign_data_boundary_support.py`, `tests/shipment_document_instance_boundary_support.py`, and `tests/test_shipment_foreign_data_boundary.py` permits only those two named facade symbols and rejects Compliance internals, ORM models, repositories, schemas, table names, broad imports, dynamic imports, raw SQL, reflection, joins, metadata access, and foreign keys. Reverse enforcement prevents Compliance from importing or reading the new Shipment mappings.

No Party public API was added: `issuing_party_name` is deliberately bounded Shipment-owned free text.

## No Binary Or File Storage

The implementation has:

- no BLOB, BYTEA, binary, varbinary, file-content, or attachment-content column;
- no `storage_key`, object-store key, bucket, path, URL, filename, content bytes, upload token, or checksum field;
- no `format: binary` or multipart OpenAPI contract;
- no file input, `FormData`, `Blob`, `FileReader`, object URL, preview, upload, download, or thumbnail pipeline; and
- no Host, Kernel, object-store, virus-scan, or file-vault infrastructure.

ORM metadata, migration source, strict Pydantic requests, generated OpenAPI, frontend source, and UI rendering all have explicit failing gates for these forbidden surfaces. `document_number` remains an external business reference only.

## Tenant, Authorization, Lifecycle, And Audit Behavior

- Every list, detail, history, lock, update, and transition predicate includes actor organization and Shipment.
- Every operation proves the same-tenant Shipment; linked requirements also match tenant, Shipment, and Compliance type.
- Reads require `shipments.read`; writes require `shipments.manage`; module operational state is enforced.
- Cross-tenant Shipment, type, requirement, and instance IDs fail without echoing rejected identifiers.
- Create starts `draft`, version 1; update and status changes require exact versions and reasons.
- Linked verification uses both exact instance and requirement versions and commits both histories/events atomically.
- A stale requirement version rolls the instance transition and history back.
- Verified-to-superseded does not automatically reverse a received requirement.
- Instance operations do not increment the Shipment header version.
- Viewer and finance roles see read-only metadata without mutation controls.
- Frontend generation guards discard stale Shipment, tenant/token, role, unmount, mutation, and 401 completions.

## Principal Files Touched

### Owner backend and migration

- `modules/shipments.core/manifest.yaml`
- `modules/shipments.core/migrations/003_shipment_document_instances.sql`
- `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/models.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/document_instance_models.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/api.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/commands.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_instance_schemas.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_instance_read_service.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_instance_write_service.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_instance_mutation_support.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_instance_requirement_support.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_write_service.py`

### Owner UI

- `modules/shipments.core/web/src/ShipmentDocumentEvidencePanels.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentInstancesPanel.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentInstanceList.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentInstanceMetadataEditor.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentInstanceStatusEditor.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentInstanceDateFields.tsx`
- `modules/shipments.core/web/src/shipmentDocumentInstanceTypes.ts`
- `modules/shipments.core/web/src/shipmentDocumentInstanceDisplay.ts`
- `modules/shipments.core/web/src/shipmentDocumentInstancesApi.ts`
- `modules/shipments.core/web/src/useShipmentDocumentInstanceReads.ts`
- `modules/shipments.core/web/src/useShipmentDocumentInstanceMutations.ts`
- `modules/shipments.core/web/src/styles/documentInstances.css`
- `modules/shipments.core/web/src/ShipmentDetail.tsx`
- `modules/shipments.core/web/src/ShipmentSupportWorkspace.tsx`
- `modules/shipments.core/web/src/moduleSurface.tsx`

### Tests, verifier, contracts, and documentation

- `modules/shipments.core/tests/test_shipment_document_instance_*.py`
- `modules/shipments.core/tests/web/ShipmentDocumentInstances.*.test.tsx`
- `modules/shipments.core/verify/UokCandidateShipmentDocumentInstances.ps1`
- `modules/shipments.core/verify/UokCandidateShipmentDocumentInstanceGuards.ps1`
- `modules/shipments.core/verify/UokCandidateShipmentSupport.ps1`
- `tests/test_shipment_foreign_data_boundary.py`
- `tests/shipment_document_instance_boundary_support.py`
- model, migration, manifest, physical-boundary, and reverse-Compliance contract tests/fixtures
- `web/src/generated/openapi.json`
- `web/src/generated/openapi.d.ts`
- current-state architecture, Shipment, Compliance, and delivery documentation

## Freeze Compliance

**Result: Yes.**

- Host has no new business logic, adapter, or composition exception: 17 HTTP adapters and 37 exact allowed imports remain.
- Kernel has no new type, port, contract, or allowlist entry.
- Business behavior, mappings, migration, APIs, UI, tests, and verifier logic live in `shipments.core`.
- Compliance remains a dependency-free vocabulary owner and never imports or writes Shipment state.
- Shipment consumes Compliance only through two exact immutable public facade symbols.
- Planning and Contacts facades remain unchanged; Gap 1–3 tests remain green.
- There is no foreign ORM/table access, cross-module foreign key/join, reverse dependency, shell cycle, module split, binary store, or file vault.
- Closed manifests now declare 108 commands, 118 events, 64 mappings, 11 verifiers, and 10 workbench surfaces.

## Verification Evidence

| Gate | Result |
|---|---|
| Shipment owner backend | Focused instance and requirement regression suites passed |
| Shipment owner frontend | 11 files / 33 tests passed, including bidirectional Requirement/Instance refresh |
| Focused frozen architecture suites | Passed, including Gap 1–3 and Host/Kernel/shell boundaries |
| Ruff, Python compile, and diff hygiene | Passed |
| Generated OpenAPI and TypeScript contract drift | Passed |
| TechnologyAudit | Passed; no new hard or soft warning, with only pre-existing Calendar/Communications/Contacts soft size warnings |
| EngineeringEvidence | Passed; ignored local evidence `var/evidence/engineering/uok_engineering_20260718T031431Z.json` |
| Audit | Passed; 153/153 isolated Python test files, zero known Python/npm vulnerabilities, generated contracts and release/source/boundary gates clean |
| Rebuild / health / capacity | Passed; exact-source image `33bf82db125a37c22300af03009f8b1db724a167fe992166371a607dfed0328d`, `/health` OK, offline/live capacity policies green |
| Verify Python / frontend / Playwright | Passed; 153 Python files, 130 Vitest files / 469 tests, production build, 19 Playwright passes plus one expected environment-gated skip |
| Authenticated candidate verifier | Passed; all 11 module verifiers, including Shipment create/update/record/verify, linked Requirement `received`, coherent 2/2 readiness, replay, redaction, and no-binary guards |
| Manual desktop and 375-pixel browser | Passed on the rebuilt runtime; verified metadata/readiness and the create editor reflow cleanly, with zero file inputs, multipart forms, upload/preview controls, or console errors |
| Draft PR / hosted CI | Draft PR [#68](https://github.com/Soyuz-Tec/UOK/pull/68) is clean and stacked on the Requirement slice; code-bearing commit `534f4734dddfb8aee0768aede6f08742c19da596` passed both [pull-request run 29631335772](https://github.com/Soyuz-Tec/UOK/actions/runs/29631335772) and [push run 29631319403](https://github.com/Soyuz-Tec/UOK/actions/runs/29631319403) with zero failed steps |

The first end-to-end verifier attempt exposed a verifier-only replay assertion:
the stable Host contract deliberately omits top-level `command_id` on replay and
retains the original correlation in `result.correlation_id`. The Shipment
verifier now asserts `idempotent == true` and that stored correlation instead
of changing the shared Host contract. Verifier AST/path tests and all 11 live
module verifiers passed after the correction.

## Manual Demo

1. In **Compliance Document Types**, create or reuse an active Commercial Invoice type.
2. Open the Africa-origin to V.O.C./Thoothukudi-style Shipment in **Shipment Support**.
3. Under **Document requirements**, add Commercial Invoice as required and confirm it is missing.
4. Under **Document instances**, choose **Add document metadata** and link that requirement.
5. Enter document number, issuing party name, issue/expiry dates, and notes; create the draft.
6. Edit the metadata with a reason, then change the instance to `recorded`; readiness remains missing.
7. Change the instance to `verified`, select **Mark linked requirement received**, and submit a reason.
8. Confirm the instance is verified, the linked requirement is received, and required readiness is satisfied.
9. Refresh and confirm list/detail/history persist without any file, upload, preview, or storage field.
10. Sign in as a viewer and confirm the evidence panels are readable but mutation-free.

## Recommended Next Slice

Deliver a **thin Intelligence/Oracle Shipment readiness signal** next, but only after adding the smallest justified immutable Shipment summary facade for that real caller. Intelligence should consume Shipment-owned readiness and instance summaries through that facade, never Shipment ORM or Compliance tables, and should remain advisory rather than block movement status. If that consumer is not yet ready, pause structure work and apply bounded operational polish to the Africa-to-V.O.C. corridor demo data.
