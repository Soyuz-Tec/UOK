# Compliance Document Type Slice Design – 2026-07-17

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Architecture authority:** `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `docs/architecture/modular-monolith-structure-re-audit-2026-07-16.md`, and `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`.

## 1. As-Is Compliance And Document Evidence

UOK has no implemented Compliance Document Type registry. Current source, migrations, reachable and deleted Git history, remote branches, and prior pull requests contain no compliance/document-type module, ORM mapping, table, migration, API, DTO, workbench, test, or candidate verifier.

The adjacent concepts have different owners and must remain separate:

| Existing concept | Evidence | Actual responsibility |
|---|---|---|
| Planning requirement labels | `modules/planning.core/backend/uok_planning_core/_internal/persistence/planning_models.py`; `modules/planning.core/migrations/008_planning_task_requirements.sql` | Planning-owned task readiness rows whose generic `requirement_type` may be `compliance` or `document`; not master data |
| Planning document links | `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` | Generic `document` targets resolve to Reports artifacts, not document-type identity |
| Report artifacts | `modules/reports.core/backend/uok_reports_core/models.py`; `modules/reports.core/backend/uok_reports_core/public_api.py`; `modules/reports.core/migrations/001_reports_core.sql` | Generated file metadata, hashes, storage keys, verification, and deletion; not compliance vocabulary |
| Shipment Support | `modules/shipments.core/backend/uok_shipments_core`; `modules/shipments.core/migrations/001_shipments_core.sql` | Operational Shipment headers and movement status only; documents and compliance packs are explicit non-goals |
| Agents compliance evidence | `modules/agents.core/manifest.yaml` | Planned AI-run governance/evidence scaffold with no executable behavior or data |

`docs/delivery/shipment-support-slice-delivery-2026-07-17.md` explicitly records the missing governed type vocabulary and recommends this registry before document instances or intelligence. No existing owner can be extended without mixing capabilities.

## 2. Gap After Shipment Support

Operators can govern Parties, Products, Locations, Routes, and Shipments, but they cannot define a tenant-approved vocabulary for the document types used in export-import operations. Free-text labels would fragment reporting and later Shipment requirements, while hard-coded global defaults would incorrectly present local workflow examples as legal truth.

The smallest valuable slice is a tenant-scoped registry that governs type identity and lifecycle only. It deliberately stops before document instances, files, Shipment applicability, validation rules, or customs enforcement.

## 3. Domain Model, Status, Tenant Keys, And Codes

### ComplianceDocumentType

| Field | Rule |
|---|---|
| `id` | Stable generated identifier |
| `organization_id` | Mandatory tenant owner derived only from the authenticated actor |
| `code` | Required normalized uppercase/hyphenated code, immutable, unique within one organization |
| `canonical_name` | Required tenant-governed display name |
| `description` | Optional explanatory text, maximum 2,000 characters |
| `category` | Optional free-text family, maximum 120 characters; descriptive only |
| `status` | Exact persisted state: `active`, `inactive`, or `archived` |
| `version` | Positive optimistic-concurrency version |
| actor/timestamps | Creator, last updater, created/updated time, optional archive time |

`required_for_shipment` and `allows_multiple` are intentionally omitted. Applicability and multiplicity depend on Shipment, corridor, counterparty, contract, and jurisdiction context; they belong in a later Shipment-to-Document-Type requirement aggregate rather than global type identity.

### Lifecycle

Create starts at `active`, version `1`. Legal transitions are:

```text
active -> inactive | archived
inactive -> active | archived
archived -> active
```

Update is allowed while `active` or `inactive`; code and status are never mutable through Update. Every update or lifecycle command requires `expected_version`, a non-empty reason, a same-tenant row lock, and a real state change.

Six explicit commands and events preserve the established master-data vocabulary:

| Command | Event |
|---|---|
| `CreateComplianceDocumentType` | `ComplianceDocumentTypeCreated` |
| `UpdateComplianceDocumentType` | `ComplianceDocumentTypeUpdated` |
| `DeactivateComplianceDocumentType` | `ComplianceDocumentTypeDeactivated` |
| `ActivateComplianceDocumentType` | `ComplianceDocumentTypeActivated` |
| `ArchiveComplianceDocumentType` | `ComplianceDocumentTypeArchived` |
| `RestoreComplianceDocumentType` | `ComplianceDocumentTypeRestored` |

### History And Audit

`ComplianceDocumentTypeNameHistory` records each canonical-name change with previous/new value, reason, actor, and timestamp. Lifecycle and non-name field changes remain correlated in the existing owner command/event evidence. No third history table is needed.

### Tenant-Reviewed Starter Vocabulary

The slice documents, but does not automatically seed, these examples:

| Example code | Example name | Suggested category |
|---|---|---|
| `BILL-OF-LADING` | Bill of Lading | Transport |
| `CERTIFICATE-OF-ORIGIN` | Certificate of Origin | Origin |
| `PHYTOSANITARY-CERTIFICATE` | Phytosanitary Certificate | Sanitary |
| `COMMERCIAL-INVOICE` | Commercial Invoice | Commercial |
| `PACKING-LIST` | Packing List | Packing |

Each tenant must review, rename, add, deactivate, or archive types for its own contracts and legal obligations. These examples are workflow vocabulary, not legal advice or final regulatory truth.

## 4. Owning Module And Justification

Create `modules/compliance.core` as an optional dependency-free `capability_module`.

This is a new module because the registry has:

- a distinct master-data language and lifecycle;
- two independently owned tables;
- its own permissions, commands/events, API, UI, verifier, and retention policy;
- a narrow immutable reference contract for later consumers; and
- no need to read or mutate Shipment, Party, Planning, Reports, Product, Location, or Route data.

It must not be embedded in Shipment, which owns operational movement; Reports, which owns generated artifacts; Planning, which owns readiness workflow; Agents, which is inert AI governance; or Kernel/Host, which must remain feature-neutral.

The module declares `dependencies: []`, API prefix `/api/compliance`, workbench section `compliance`, and permissions `compliance.read` and `compliance.manage`.

## 5. Minimal Public API Symbols

`uok_compliance_core.public_api` exposes exactly:

1. `ComplianceDocumentTypeReferenceDTO`
2. `resolve_compliance_document_type_references`
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

The frozen reference DTO contains only stable ID, resolution status, code, canonical name, category, lifecycle status, and status summary. The resolver returns an immutable tuple. With no IDs it returns active tenant-visible choices; explicitly requested inactive/archived rows return `unavailable` with safe value data; denied, foreign, missing, or disabled-provider cases fail closed. It exposes no ORM object, repository, SQLAlchemy expression, tenant object, or mutable collection.

This new-module facade is required by the product brief and establishes the extraction-safe contract for the planned Shipment requirement consumer. It does not widen Planning or Contacts.

## 6. Cross-Module References

There are none in this slice.

- `compliance.core` imports no other feature package or public API.
- Its manifest has no feature dependency.
- It stores no Party, Shipment, Product, Location, Route, Planning, Reports, Calendar, or Communications ID.
- No existing module is edited to consume Compliance.
- The future Shipment requirement/link slice must use only `resolve_compliance_document_type_references` and stable DTO IDs.

## 7. Data Ownership And Migration Plan

`modules/compliance.core/migrations/001_compliance_core.sql` creates only:

| Table / mapping | Purpose |
|---|---|
| `compliance_document_types` / `ComplianceDocumentType` | Tenant-owned type identity, descriptive metadata, lifecycle, version, and actor/timestamp evidence |
| `compliance_document_type_name_history` / `ComplianceDocumentTypeNameHistory` | Same-owner append-only canonical-name changes |

Integrity rules:

- unique `(organization_id, code)`;
- `status IN ('active', 'inactive', 'archived')`;
- `version >= 1`;
- owner-local history foreign key only;
- indexes for tenant/status/name, tenant/category, and tenant/type/history time;
- only universal organization/user foreign keys plus the owner-local history parent.

Root and foreign module migrations must be rejected if they create, alter, reference, or drop Compliance-owned tables. Compliance migrations must be rejected if they mention another feature table. `src/uok/seed.py` remains unchanged; all example records are created through owner commands so audit and tenant ownership are preserved.

## 8. Tenant Isolation

- Every list, detail, history, reference, lock, update, and lifecycle predicate includes `actor.organization_id`.
- Organization identity is never accepted from request/command payloads or exposed in response/public DTOs.
- Code uniqueness is tenant-local, so two organizations may use the same code.
- Reads require `compliance.read`; writes require `compliance.manage`; all operations require the module to be operational.
- Mutations select by `(id, organization_id)` and enforce `expected_version`.
- Foreign-tenant IDs return not-found/missing behavior without disclosing existence.
- History first resolves the same-tenant owner and also filters by organization.
- Tests prove same-code multi-tenancy and cross-tenant denial for detail, history, update, lifecycle, list, and public-reference access.

## 9. UI Surfaces

One module-owned **Compliance Document Types** workspace provides:

- searchable, sortable list with status and category filters;
- selected detail with code, name, description, category, lifecycle, version, timestamps, and name history;
- **New document type** form;
- **Edit** form for name, description, and category while active/inactive;
- reasoned **Deactivate**, **Activate**, **Archive**, and **Restore** actions according to legal transitions;
- read-only behavior for actors without `compliance.manage`;
- archived rows hidden by default and available through an explicit filter.

All UI source and CSS live in `modules/compliance.core/web/src`; tests live in `modules/compliance.core/tests/web`. The canonical `moduleSurface.tsx` receives the neutral `ModuleSurfaceRenderContext`: the base host context plus the registry-owned `surfaceActive` value. No shell, generated-catalog, or foreign-module import is allowed. Components, state, editor, actions, and tests are split before reaching source-size limits.

## 10. Test Plan

### Unit And Domain

- Code/name/category/description normalization and strict extra-field rejection.
- Three-state transition table, immutable code, update restrictions, required reasons, and optimistic versions.
- Frozen reference DTO and immutable tuple results.

### API And Integration

- Create, detail, list, update, name history, deactivate, activate, archive, and restore.
- Idempotency, expected-version conflict, permission denial, module disablement, and command/event correlation.
- Active-only reference choices and explicit unavailable resolution for inactive/archived types.
- Archived list exclusion plus explicit inclusion.

### Tenant Isolation

- Same code in two organizations.
- Cross-tenant detail, history, update, transition, and reference attempts fail closed.
- No tenant identity appears in requests or response DTOs.

### Frontend

- Signed-out/install/enable/loading/error states.
- Search, category/status filters, sort, keyboard row selection, create/edit payloads, lifecycle buttons, and version progression.
- Viewer/finance read-only behavior, 401/403 handling, global-refresh reload, responsive narrow layout, and no ID/state leakage.

### Architecture Gates

- Add a dedicated Compliance boundary scan rejecting every foreign feature-package import, dynamic import, registered foreign ORM/model/table token, raw SQL, reflection, and metadata access; separately enforce an empty feature dependency manifest and owner-only migration tables.
- Add exact six-symbol facade enforcement and frozen DTO assertions.
- Extend only the exact Compliance HTTP adapter allowance for `get_db` and `current_actor`.
- Extend manifest, physical ownership, model registry/metadata, migration ownership, verifier, frontend catalog, generated-contract, and documentation gates.
- Keep every Gap 1–3 test, Planning/Contacts facade count, Kernel boundary, shell contract, and Shipment foreign-data test green.

## 11. Architecture Freeze Compliance Checklist

- [x] Business behavior, mappings, migration, UI, tests, and verifier belong only to `compliance.core`.
- [x] Host changes are limited to manifest-driven composition and the exact tested request-adapter seam.
- [x] Kernel receives no code, mapping, permission, helper, port, or allowlist growth.
- [x] No foreign ORM, table, join, feature key, repository, or module-internal import is designed.
- [x] No Planning/Contacts facade is widened.
- [x] No shell contract or shell-to-feature import is added.
- [x] The facade has exactly six supported symbols; its reference DTO and resolver results are immutable/value-only, and no symbol exports a persistence type.
- [x] The module has no feature dependency or cross-owner SCC.
- [x] Example vocabulary is documented, tenant-reviewed, and not auto-seeded as legal truth.
- [x] New-module boundary tests and all existing Gap 1–3 gates remain mandatory.

## 12. Non-Goals

- Compliance document instances, Shipment document requirements, document packs, or enforcement that blocks Shipment status.
- File upload, object storage, binary versioning, preview, download, OCR, e-signature, or retention vault.
- Customs broker/carrier/government integrations, declarations, submissions, permits, or automated legal decisions.
- Jurisdiction/corridor rules, required-document rules engine, multiplicity rules, expiry logic, validation schemas, or conditional applicability.
- Intelligence/Oracle scores, readiness recommendations, anomaly detection, or risk ranking.
- Party/Shipment/Product/Location/Route/Planning/Reports data access or UI links.
- Hard-coded legal truth, automatic tenant seed data, bulk import/export, hard delete, module split, Kernel growth, or shell refactor.

## 13. Demo Script

1. Install `compliance.core` and open **Compliance Document Types**.
2. Create `BILL-OF-LADING`, `CERTIFICATE-OF-ORIGIN`, `PHYTOSANITARY-CERTIFICATE`, `COMMERCIAL-INVOICE`, and `PACKING-LIST` as tenant-reviewed examples.
3. Search for `PHYTOSANITARY`, filter category `Sanitary`, and open the exact row.
4. Edit its name or description with a reason and verify version/name-history evidence.
5. Deactivate it and confirm the Inactive filter shows it while active reference choices exclude it.
6. Activate it and confirm it returns to active reference choices.
7. Archive one example, confirm default lists hide it, then include archived rows and restore it.
8. Sign in under another tenant and confirm the records are absent; use a viewer role and confirm all mutation controls are absent.

## Validation

Implementation acceptance requires owner backend/frontend suites, the dedicated no-foreign-data boundary test, all frozen architecture gates, generated-contract checks, TechnologyAudit, EngineeringEvidence, Audit, a rebuilt PostgreSQL candidate, full Verify, authenticated verifier evidence, browser proof at desktop and 375px, GitHub preflight/readiness, a stacked draft PR, and green hosted CI at the final head.
