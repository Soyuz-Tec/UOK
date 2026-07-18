# Compliance Document Type Module Plan

**Module:** `compliance.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/compliance.core`

## Purpose And Authority

`compliance.core` is the optional Compliance Document Type master-data owner.
It governs tenant-specific document-type vocabulary and lifecycle without
owning document instances, binary files, Shipment requirements, customs rules,
or legal decisions.

Detailed design and delivery evidence:

- `docs/delivery/compliance-document-type-slice-design-2026-07-17.md`
- `docs/delivery/compliance-document-type-slice-delivery-2026-07-17.md`

The approved downstream Shipment requirement-metadata design is:

- `docs/delivery/shipment-document-requirements-slice-design-2026-07-17.md`
- `docs/delivery/shipment-document-requirements-slice-delivery-2026-07-17.md`

## First Slice

The first slice owns:

- organization-unique immutable Document Type codes;
- canonical name plus optional description and descriptive category;
- explicit `active`, `inactive`, and `archived` lifecycle states;
- optimistic version checks and append-only canonical-name history;
- tenant-scoped list, detail, history, and immutable reference reads;
- governed create, update, deactivate, activate, archive, and restore commands;
- a module-owned Compliance Document Types workbench and candidate verifier.

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/compliance.core/manifest.yaml` |
| Backend behavior and private ORM | `modules/compliance.core/backend/uok_compliance_core` |
| Schema changes | `modules/compliance.core/migrations` |
| Backend and frontend tests | `modules/compliance.core/tests` |
| Candidate verifier | `modules/compliance.core/verify` |
| Production React and CSS | `modules/compliance.core/web/src` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The facade exports only the frozen
`ComplianceDocumentTypeReferenceDTO`,
`resolve_compliance_document_type_references`, and four runtime-composition
hooks. ORM mappings, repositories, services, request schemas, and HTTP adapters
remain private.

## Data And Integrity Rules

- Every type and name-history row belongs to exactly one organization.
- Codes are normalized, immutable, and unique only within one organization.
- New rows start `active` at version `1`.
- `active` may become `inactive` or `archived`; `inactive` may become `active`
  or `archived`; `archived` may be restored to `active`.
- Update is allowed only while active or inactive; code and lifecycle state
  cannot change through the Update command.
- Every non-create mutation requires a non-empty reason and exact expected
  version under a same-tenant row lock.
- Canonical-name changes append owner-local history. Other mutations retain
  correlated command and event evidence.
- Lists hide archived rows unless explicitly requested. Public reference
  choices return active rows; explicit inactive or archived IDs resolve as
  unavailable value data.
- `shipments.core` may consume only
  `ComplianceDocumentTypeReferenceDTO` and
  `resolve_compliance_document_type_references`; Compliance never imports or
  writes Shipment behavior, mappings, or tables.
- All reads and writes enforce actor organization, permission, module
  operational state, and optimistic version.
- The module declares no feature dependency and stores no Party, Shipment,
  Product, Location, Route, Planning, Reports, Calendar, or Communications ID.

## Public And UI Contracts

- List API: `/api/compliance/document-types`
- Detail API: `/api/compliance/document-types/{compliance_document_type_id}`
- Name history:
  `/api/compliance/document-types/{compliance_document_type_id}/name-history`
- Commands: `CreateComplianceDocumentType`,
  `UpdateComplianceDocumentType`, `DeactivateComplianceDocumentType`,
  `ActivateComplianceDocumentType`, `ArchiveComplianceDocumentType`, and
  `RestoreComplianceDocumentType`
- Permissions: `compliance.read`, `compliance.manage`
- Workbench section: `compliance`

The list supports search, category, status, and explicit archived inclusion.
Module-owned UI provides list, detail, create/edit, lifecycle actions, and
name-history evidence without importing Shell or another feature.

## Tenant-Reviewed Examples

Tenants may choose to create Bill of Lading, Certificate of Origin,
Phytosanitary Certificate, Commercial Invoice, and Packing List types. These
are editable workflow examples, not automatic seed data, legal advice, or a
complete statement of regulatory requirements.

## Non-Goals

Document instances, file upload/storage, binary versioning, e-signature, OCR,
Shipment requirement enforcement, jurisdiction rules, multiplicity rules,
expiry, customs integrations, Intelligence scoring, Party/Shipment reads,
hard-coded legal truth, automatic tenant seeds, hard delete, module splits,
Kernel growth, and shell-contract changes.

## Qualification

Before promotion:

```powershell
python -m pytest -q -p no:cacheprovider modules/compliance.core/tests --ignore=modules/compliance.core/tests/web
python -m pytest -q -p no:cacheprovider tests/test_compliance_document_type_data_boundary.py tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Runtime acceptance additionally requires a rebuilt PostgreSQL candidate,
authenticated Compliance verifier evidence, browser proof of create/filter/edit
and lifecycle behavior, GitHub preflight/readiness, and green hosted CI at the
final PR head.

## Next Slice Boundary

The approved downstream boundary is a tenant-scoped
Shipment-to-Document-Type requirement link owned entirely by
`shipments.core`. Shipment consumes only the immutable Compliance resolver;
Compliance continues to own type vocabulary and gains no Shipment dependency,
file vault, document instance, or Shipment lifecycle rule.
