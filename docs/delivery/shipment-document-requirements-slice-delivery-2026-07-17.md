# Shipment Document Requirements Slice Delivery – 2026-07-17

**Status:** Delivered, locally qualified on the rebuilt PostgreSQL candidate,
and published as draft PR
[#67](https://github.com/Soyuz-Tec/UOK/pull/67) with green code-bearing CI.

**Candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/shipment-document-requirements-slice-design-2026-07-17.md`

## What Shipped

`shipments.core` now owns a tenant-scoped Document Type requirement aggregate
for each Shipment. Operators can:

- add one active Compliance Document Type as `required` or `optional`;
- update the requirement level and operational notes;
- record `missing`, `received`, `waived`, or `not_applicable`;
- remove the current link while retaining append-only owner history and normal
  command/event evidence; and
- read a factual, non-blocking summary of required satisfaction.

The Shipment detail workbench exposes these actions in a responsive
**Document requirements** panel. There are no upload, file, blob, preview,
download, signature, OCR, or document-vault controls. Requirement state does
not block any otherwise-valid Shipment lifecycle transition.

## Data And Migration

The forward-only owner migration is:

- `modules/shipments.core/migrations/002_shipment_document_requirements.sql`

It creates:

| Shipment-owned mapping | Table | Purpose |
|---|---|---|
| `ShipmentDocumentRequirement` | `shipment_document_requirements` | Current applicability, status, notes, independent version, actor, and timestamps |
| `ShipmentDocumentRequirementHistory` | `shipment_document_requirement_history` | Append-only snapshots for add, update, status change, and remove |

The active-link uniqueness key is
`(organization_id, shipment_id, compliance_document_type_id)`. The only feature
foreign key is owner-local `shipments.id`. `compliance_document_type_id` is
bounded text with no Compliance foreign key, relationship, copied metadata, or
cross-owner join.

The runtime now composes 53 feature mappings plus nine Kernel mappings
(62 total). A final PostgreSQL rebuild exposed and closed one identifier-length
blind spot: explicit Shipment and existing Compliance history index names now
fit PostgreSQL's 63-character limit, and
`tests/test_module_model_registry.py` enforces that limit across every composed
table, column, constraint, and index.

## Public API Surface

### Shipment reads

- `GET /api/shipments/document-type-options`
- `GET /api/shipments/records/{shipment_id}/document-requirements`
- `GET /api/shipments/records/{shipment_id}/document-requirements/{requirement_id}/history`

The list response contains immutable serialization-safe owner DTOs and:

- `required_total`
- `required_satisfied`
- `required_missing`
- `required_received`
- `required_waived`
- `required_not_applicable`
- `optional_total`

### Shipment commands

- `AddShipmentDocumentRequirement`
- `UpdateShipmentDocumentRequirement`
- `SetShipmentDocumentRequirementStatus`
- `RemoveShipmentDocumentRequirement`

All four use `shipments.manage`, the existing Host command transport,
idempotency log, correlated Shipment requirement event scope, and expected
versions where the link already exists.

The Python facade remains exactly six symbols in
`modules/shipments.core/backend/uok_shipments_core/public_api.py`. No
speculative readiness DTO was added because this slice has no external Python
consumer.

## Compliance Via Immutable DTO Proof

Shipment's only Compliance production import is in
`modules/shipments.core/backend/uok_shipments_core/_internal/delivery/compliance_gateway.py`:

```python
from uok_compliance_core.public_api import (
    ComplianceDocumentTypeReferenceDTO,
    resolve_compliance_document_type_references,
)
```

The resolver supplies active option data, validates a requested same-tenant
type, and renders current owner value data for existing links. New links reject
inactive, archived, unknown, denied, foreign-tenant, or unavailable types.
Existing links remain operable and auditable if Compliance later deactivates a
type. Denied resolutions redact the stored type ID from actor-facing responses
and UI fallback text.

Enforcement in `tests/shipment_foreign_data_boundary_support.py` and
`tests/test_shipment_foreign_data_boundary.py` permits only those two named
facade symbols and rejects Compliance internals, ORM models, table names,
schema/repository access, broad facade imports, dynamic imports, raw SQL,
reflection, joins, metadata access, and foreign keys.

## Tenant, Authorization, And Audit Behavior

- Every list, history, lock, update, status, and remove predicate includes the
  actor organization and Shipment.
- Every read first proves the same-tenant Shipment through the owner service.
- Organization identity is derived from the immutable actor and is absent from
  request and response payloads.
- Reads require `shipments.read`; writes require `shipments.manage`.
- Viewer and finance roles see read-only requirement data with no mutation
  controls.
- Add starts at `missing`, version 1; update/status/remove use optimistic
  concurrency and a reason.
- Add, update, status, and remove are idempotent through the Host command
  contract.
- Remove preserves history and event evidence; an active type can be re-added
  later with a new link ID.
- Requirement mutations do not increment the Shipment header version and do
  not block movement status.

## Principal Files Touched

### Owner backend and migration

- `modules/shipments.core/manifest.yaml`
- `modules/shipments.core/migrations/002_shipment_document_requirements.sql`
- `modules/shipments.core/backend/uok_shipments_core/_internal/persistence/models.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/api.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/commands.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/compliance_gateway.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_schemas.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_read_service.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_write_service.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/document_requirement_mutation_support.py`

### Owner UI

- `modules/shipments.core/web/src/ShipmentDocumentRequirementsPanel.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentRequirementEditor.tsx`
- `modules/shipments.core/web/src/ShipmentDocumentRequirementList.tsx`
- `modules/shipments.core/web/src/shipmentDocumentRequirementsApi.ts`
- `modules/shipments.core/web/src/shipmentDocumentRequirementTypes.ts`
- `modules/shipments.core/web/src/shipmentDocumentRequirementDisplay.ts`
- `modules/shipments.core/web/src/useShipmentDocumentRequirementReads.ts`
- `modules/shipments.core/web/src/useShipmentDocumentRequirementMutations.ts`
- `modules/shipments.core/web/src/styles/documentRequirements.css`
- `modules/shipments.core/web/src/ShipmentDetail.tsx`
- `modules/shipments.core/web/src/ShipmentSupportWorkspace.tsx`
- `modules/shipments.core/web/src/moduleSurface.tsx`

The read and mutation hooks invalidate request generations on keyed unmount and
guard 401 callbacks, preventing an old tenant/token/Shipment request from
clearing or updating a replacement session.

### Tests, verifier, and contracts

- `modules/shipments.core/tests/test_shipment_document_requirement_domain.py`
- `modules/shipments.core/tests/test_shipment_document_requirement_integration.py`
- `modules/shipments.core/tests/test_shipment_document_requirement_readd.py`
- `modules/shipments.core/tests/test_shipment_document_requirement_tenant_isolation.py`
- `modules/shipments.core/tests/web/ShipmentDocumentRequirements.*.test.tsx`
- `modules/shipments.core/verify/UokCandidateShipmentRequirements.ps1`
- `modules/shipments.core/verify/UokCandidateShipmentRequirementTypes.ps1`
- `modules/shipments.core/verify/UokCandidateShipmentSupport.ps1`
- `tests/test_shipment_foreign_data_boundary.py`
- `tests/test_module_model_registry.py`
- `tests/test_migration_discipline.py`
- `web/src/generated/openapi.json`
- `web/src/generated/openapi.d.ts`
- `web/src/generated/moduleSurfaceCatalog.ts`

The new Shipment dependency also required the existing Planning Shipment-link
integration fixture to install `compliance.core` before `shipments.core`, which
now mirrors the validated manifest order.

## Freeze Compliance

**Result: Yes.**

- Host gained no business logic, adapter, or composition exception: still 17
  HTTP adapters and 37 exact allowed Host imports.
- Kernel gained no type, port, contract, or allowlist entry.
- All new behavior, persistence, history, APIs, UI, tests, and verifier logic
  live in `shipments.core`.
- Compliance remains a dependency-free vocabulary owner and never imports or
  writes Shipment state.
- Shipment consumes Compliance only through two immutable public facade
  symbols.
- Planning and Contacts facades were not widened or bypassed.
- There is no foreign ORM/table access, cross-module join, reverse dependency,
  shell cycle, module split, or file vault.
- Gap 1–3 architecture tests remain unchanged in intent and green.

## Verification Evidence

| Gate | Result |
|---|---|
| Shipment owner backend | 21 tests passed |
| Shipment owner frontend | 6 files / 19 tests passed |
| Focused Shipment/Planning/manifest/model/migration/boundary suites | Passed |
| Ruff and Python compile | Passed |
| Generated OpenAPI/TypeScript/module catalog drift | Passed |
| TechnologyAudit | Passed |
| EngineeringEvidence | Generated under `var/evidence/engineering` (local-only) |
| Audit | 148 isolated Python test files passed; zero known Python/npm vulnerabilities |
| Rebuild | Passed; image `8e523b21aea8e174ffa24fa24fb3c1d066f6c42a39d10c29d58fba674e051282`; `/health` OK |
| Live database capacity | Passed; one UOK API session, no non-UOK sessions, declared headroom preserved |
| Verify frontend | 125 files / 455 tests passed; static build passed |
| Verify Playwright | 19 passed, one intentionally skipped |
| Candidate verifier | All 11 module verifiers passed in dependency order |
| Manual desktop browser | Added required type, observed missing summary, set Received, observed version 2 and zero missing |
| Manual 375px browser | No horizontal or interactive overflow, no file input, no console error |
| Draft PR / hosted CI | [PR #67](https://github.com/Soyuz-Tec/UOK/pull/67), stacked on `feature/compliance-document-type-slice`; code-bearing SHA `5cf62f329dd7dc0a335bb84a99e6c0ab0f8966d8`; [push run 29623760164](https://github.com/Soyuz-Tec/UOK/actions/runs/29623760164) and [PR run 29623784824](https://github.com/Soyuz-Tec/UOK/actions/runs/29623784824) passed |

The first Rebuild attempt correctly failed closed on an overlong PostgreSQL
index name. The identifier was shortened in both owner model and migration,
the pre-existing Compliance model/migration index naming was aligned, the
global regression was added, and the subsequent Rebuild and full Verify passed.

## Manual Demo

1. Open **Compliance Document Types** and create or reuse active
   Bill of Lading and Certificate of Origin types.
2. Open **Shipment Support** and select an Africa-origin to V.O.C./Thoothukudi
   Shipment.
3. In **Document requirements**, add Bill of Lading as required and confirm it
   starts `Missing`.
4. Add or edit Certificate of Origin as required or optional with an
   operational note.
5. Move an otherwise-valid draft Shipment to planned while requirements are
   missing; the summary remains informational.
6. Use **Set status** to mark one link `Received` and another `Waived`,
   supplying reasons; confirm received/waived/missing counts update.
7. Remove a link and confirm it leaves the current list while audit history and
   events remain.
8. Deactivate a Compliance type and confirm it cannot be newly attached.
9. Sign in as viewer and confirm the panel is readable but mutation-free.
10. Sign in under another tenant and confirm the Shipment and links are absent.

## Recommended Next Slice

Deliver **Compliance document-instance metadata without binary storage** next.
The code now records that a requirement is `received`, but operations still
lack the smallest evidence fields that make that state useful—document
reference, issuer, issue/expiry dates, and the requirement it satisfies.
Keeping the next slice metadata-only closes that operational gap without a
file vault or workflow engine. Thin Intelligence readiness signals should
follow once a real external consumer justifies adding an immutable Shipment
summary facade.
