# Compliance Document Type Slice Delivery – 2026-07-17

**Status:** Delivered in draft pull request
[#66](https://github.com/Soyuz-Tec/UOK/pull/66); local qualification and
code-bearing hosted CI are green.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/compliance-document-type-slice-design-2026-07-17.md`

## What Shipped

UOK now has a tenant-scoped Compliance Document Type master-data capability in
`compliance.core`:

- organization-unique immutable type codes;
- canonical name, optional description, and optional descriptive category;
- explicit `active`, `inactive`, and `archived` lifecycle states;
- reasoned, optimistic-versioned update, deactivate, activate, archive, and
  restore operations;
- append-only canonical-name history plus correlated command/event evidence;
- organization-scoped list, detail, history, and immutable reference reads;
- active-only reference choices and lifecycle-aware resolution of explicitly
  requested inactive or archived records;
- a module-owned Compliance Document Types workspace for search, category and
  status filters, list/detail, create/edit, name-history review, and legal
  lifecycle actions;
- a closed manifest, owner migration, owner tests, exact no-foreign-data
  enforcement, generated contracts, and a runtime candidate verifier.

The slice deliberately has no document instance, binary file, Shipment rule,
customs integration, legal decision, Party link, or foreign-module read.
`required_for_shipment` and `allows_multiple` were not added because those facts
depend on a later Shipment requirement aggregate rather than type identity.

Five RCN trade examples are documented for tenant review rather than seeded as
global truth: Bill of Lading, Certificate of Origin, Phytosanitary Certificate,
Commercial Invoice, and Packing List.

## Files And Migrations

| Area | Paths |
|---|---|
| Design and delivery | `docs/delivery/compliance-document-type-slice-design-2026-07-17.md`; `docs/delivery/compliance-document-type-slice-delivery-2026-07-17.md` |
| Module plan | `docs/modules/compliance.core/COMPLIANCE_DOCUMENT_TYPE_MODULE_PLAN.md` |
| Closed module contract | `modules/compliance.core/manifest.yaml`; module-local README files |
| Private backend and facade | `modules/compliance.core/backend/uok_compliance_core/**` |
| Owner migration | `modules/compliance.core/migrations/001_compliance_core.sql`; migration README |
| Owner backend tests | `modules/compliance.core/tests/test_compliance_document_type_domain.py`; `test_compliance_document_type_integration.py`; `test_compliance_document_type_tenant_isolation.py`; `test_compliance_document_type_reference_api.py`; `compliance_test_support.py` |
| Owner frontend and tests | `modules/compliance.core/web/src/**`; `modules/compliance.core/tests/web/**` |
| Candidate verifier | `modules/compliance.core/verify/UokCandidateComplianceDocumentType.ps1` |
| Architecture enforcement | `tests/test_compliance_document_type_data_boundary.py`; `tests/compliance_document_type_data_boundary_support.py`; public-facade, Host allowlist, model registry/fixtures, migration, physical/manifest, verifier, Shipment-boundary, and frontend catalog gates |
| Generated contracts | `web/src/generated/openapi.json`; `openapi.d.ts`; `moduleSections.ts`; `moduleSurfaceCatalog.ts` |
| Living architecture | `docs/ARCHITECTURE.md`; `docs/DOCUMENTATION_INDEX.md`; ADR-0028; active freeze; module extension/boundary/roadmap/Product-Cargo policy docs; `modules/README.md`; Shipment module plan |

`modules/compliance.core/migrations/001_compliance_core.sql` creates only:

- `compliance_document_types`
- `compliance_document_type_name_history`

The only feature-local foreign key is name history to its owning Document Type.
There is no Party, Shipment, Product, Location, Route, Planning, Reports,
Calendar, Communications, or other feature foreign key or database join.

## Public API Symbols

`modules/compliance.core/backend/uok_compliance_core/public_api.py` exposes
exactly:

1. `ComplianceDocumentTypeReferenceDTO`
2. `resolve_compliance_document_type_references`
3. `api_router`
4. `command_handlers`
5. `command_permissions`
6. `role_grants`

The frozen reference DTO contains only stable ID, resolution status, code,
canonical name, category, lifecycle status, and a status summary. The resolver
returns an immutable tuple, defaults to active tenant-visible choices, preserves
request order, and fails closed for denied, missing, foreign-tenant,
non-operational, inactive, or archived targets. It exposes no ORM object,
repository, SQLAlchemy expression, tenant object, or mutable collection.

No existing facade was widened, including Planning and Contacts.

## No-Foreign-Data Proof

`compliance.core` has `dependencies: []` and no cross-module reference in this
slice. `tests/test_compliance_document_type_data_boundary.py` scans production
source and its migration and rejects:

- every feature import, including public facades, wildcard/private imports, and
  dynamic imports;
- registered foreign ORM/model/table tokens;
- raw SQL, SQL text, reflection, metadata, and related escape hatches; and
- foreign feature tables or keys in the Compliance migration.

The generic facade, model-registry, migration-ownership, physical-boundary, and
Host/Kernel gates provide independent enforcement. Shipment's boundary scanner
also knows the Compliance model/table names so a later Shipment change cannot
read them directly.

## Tenant And Lifecycle Proof

- Every list, detail, history, lock, update, transition, and reference query
  includes the authenticated actor's `organization_id`.
- Requests and public/read DTOs never accept or expose organization identity.
- Two organizations may reuse the same code; cross-tenant detail, history,
  update, lifecycle, list, and reference reads fail closed.
- Code is normalized at creation and is absent from the update contract.
- Update and every lifecycle action require `expected_version`, a non-blank
  reason, a same-tenant row lock, and a real legal change.
- Active records may become inactive or archived; inactive records may become
  active or archived; archived records may only be restored to active.
- Archived records are hidden from normal lists unless explicitly requested.
- Only canonical-name changes append owner-local name history; every successful
  mutation emits correlated command/event evidence.
- Tenant/session changes, refreshes, selections, history reads, and mutations
  use request-generation guards so stale async completions cannot repopulate or
  mutate the wrong tenant's workspace state.

## Architecture Freeze Compliance

**Compliant:** Yes.

| Freeze rule | Evidence |
|---|---|
| Feature behavior stays in owner | `modules/compliance.core/backend`, `web/src`, `migrations`, `tests`, and `verify` |
| No foreign data access | Dependency-free manifest plus `tests/test_compliance_document_type_data_boundary.py` |
| Host remains composition only | Compliance HTTP adapter imports only allowlisted `get_db` and `current_actor`; exact Host adapter inventory is 37 |
| Kernel remains stable | No Kernel file, port, mapping, helper, permission, or allowlist was added |
| Narrow public API | Exact six-symbol, frozen/value-only facade is contract-tested |
| Planning/Contacts stay narrow | Neither facade nor internal package changed |
| Shell remains neutral | Owner-local surface is composed through the unchanged neutral `ModuleSurfaceHostContext` and generated catalog |
| Owner data is isolated | Two Compliance mappings bring the registry to 60 total; there is no foreign feature key |

ADR-0028 and the active freeze record the Compliance HTTP adapter's two accepted
in-process Host seams, increasing the exact allowlist from 35 to 37 without
changing Host responsibilities. The module adds no Kernel dependency, shell
backedge, feature dependency, foreign ORM edge, or cross-owner SCC.

## Verification, CI, And PR Status

Current evidence:

| Gate | Result |
|---|---|
| Compliance owner backend suites | Pass — 15 tests |
| Compliance no-foreign-data boundary | Pass — 16 tests |
| Focused frozen architecture/model/migration gates | Pass |
| Candidate verifier catalog/static contract | Pass — 10 tests |
| Generated OpenAPI and module catalogs | Pass — drift-free |
| Owner frontend tests | Pass — 5 files / 13 tests |
| Focused Ruff and Python compilation | Pass |
| TechnologyAudit | Pass — no Compliance violation; only the pre-existing Calendar, Communications, and Contacts soft size warnings remain |
| EngineeringEvidence | Pass — `var/evidence/engineering/uok_engineering_20260717T185704Z.json` (ignored, local-only) |
| Full Audit | Pass — 144/144 Python test files; dependency, generated-contract, release-contract, boundary, naming, size, and folder gates clean |
| Local candidate Rebuild | Pass — OCI image digest `2719df7acb71fd9046065403f43e482d711329b667d8c0eda08c915acfdc0030`; `/health` reports `ok`; offline and live database-capacity checks pass |
| Local candidate Verify and Compliance verifier | Pass — 144 Python files; 121 frontend files / 447 tests; production build; Playwright 19 passed plus 1 expected environment-gated skip; 11/11 candidate verifiers |
| Browser Compliance proof | Pass — desktop create, audited rename, deactivate/activate, archive/restore, and stable-code search; 375px override has no horizontal overflow (`scrollWidth == clientWidth == 360`); no console warning/error |
| Draft PR / hosted CI | Pass — [draft PR #66](https://github.com/Soyuz-Tec/UOK/pull/66); exact code head `68ad7526e2d84702ebb9fb5f2b746ec54ad1d6cf`; [push run 29613874618](https://github.com/Soyuz-Tec/UOK/actions/runs/29613874618) and [PR run 29613876599, attempt 2](https://github.com/Soyuz-Tec/UOK/actions/runs/29613876599) succeeded |

The module release-contract totals are 12 modules, 101 commands, 111 events, 60
ORM mappings, 17 manifest-declared HTTP adapters, 37 exact accepted Host imports,
11 candidate verifiers, and 10 frontend surfaces.

The final clean `Verify` retry passed end to end. An earlier attempt had one
unrelated Planning Board focus assertion fail transiently; the exact scenario
passed in isolation, and the complete retry then passed without code changes.

The first hosted PR run exposed a timing-sensitive await in the new Compliance
lifecycle test while the same commit's push run passed. Commit `68ad752`
explicitly awaits React's async lifecycle mutation flush; the focused test then
passed 5/5 stress runs and the full local 121-file / 447-test suite. On that
exact head the push workflow passed; the first PR attempt later hit a different,
pre-existing Shipment async-wait flake that passed 5/5 focused local runs. The
unchanged PR job rerun passed every test, frontend build, and OCI build. No
production behavior or out-of-scope Shipment code changed.

## Manual Demo

1. Sign in as an operations manager, trader, or platform administrator.
2. Install `compliance.core` and open **Compliance Document Types**.
3. Create tenant-reviewed examples such as `BILL-OF-LADING`,
   `CERTIFICATE-OF-ORIGIN`, `PHYTOSANITARY-CERTIFICATE`,
   `COMMERCIAL-INVOICE`, and `PACKING-LIST`.
4. Search for `PHYTOSANITARY`, filter category `Sanitary`, and open the row.
5. Edit its canonical name or description with a reason and inspect the version
   increment and append-only name history.
6. Deactivate it and confirm the Inactive filter shows it while active reference
   choices exclude it.
7. Activate it, then archive another example, confirm normal lists hide the
   archived row, include archived rows explicitly, and restore it.
8. Sign in under another organization and confirm the records are absent; use a
   viewer role and confirm mutation controls are absent.

## Residual Risks

- FastAPI session/auth injection remains the accepted in-process Host adapter
  seam. Extraction would replace that adapter without changing Compliance
  behavior or its immutable facade.
- Static enforcement cannot prove every computed string/import or native
  database extension. The slice uses none; AST, SQL, model-registry, review, and
  runtime gates remain required.
- Categories are intentionally free text. A future governed category vocabulary
  needs concrete reporting evidence before adding another master.
- No global defaults are installed. Each tenant must review and create the
  document-type vocabulary appropriate to its contracts and obligations.

No P0 architecture, tenancy, authorization, lifecycle, or data-ownership
residual is currently known.

## Recommended Next Slice

The strongest next slice is a tenant-scoped **Shipment-to-Document-Type
requirement link**, still without a file vault. Shipment now owns the operational
record and Compliance owns governed type vocabulary, so a small Shipment-owned
requirement aggregate can reference immutable Compliance IDs through
`resolve_compliance_document_type_references`. It should record applicability
and multiplicity per Shipment without reading Compliance tables, storing type
metadata, uploading files, or blocking the Shipment lifecycle. A Compliance
document-instance metadata slice should follow only when the team defines the
minimum non-binary instance facts; thin Intelligence should follow after those
operational signals exist.
