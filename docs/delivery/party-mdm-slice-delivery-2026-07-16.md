# Party/MDM Product Master Slice Delivery – 2026-07-16

**Status:** Implementation and local qualification complete; hosted CI pending publication.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Record the behavior, ownership, freeze compliance, validation, demo path, and next delivery boundary for the first post-freeze Product/Material MDM slice.

**Scope:** `product.master` only. Party remains the golden identity owned by `contacts.core`.

## What Shipped

### API and behavior

- A new optional `product.master` capability module with one four-symbol composition facade at `modules/product.master/backend/uok_product_master/public_api.py`.
- Tenant-scoped Product Definition list, detail, and canonical-name history reads:
  - `GET /api/products/definitions`
  - `GET /api/products/definitions/{product_definition_id}`
  - `GET /api/products/definitions/{product_definition_id}/name-history`
- Four owner commands:
  - `CreateProductDefinition`
  - `UpdateProductDefinition`
  - `ArchiveProductDefinition`
  - `RestoreProductDefinition`
- Organization-unique normalized product codes, immutable codes after creation, optimistic expected-version mutation checks, recoverable archive/restore, and normal UOK idempotency/audit correlation.
- Immutable, serialization-safe HTTP response DTOs. No ORM mapping or repository crosses the owner boundary.

### Data

- `ProductDefinition` / `product_definitions` owns canonical tenant Product/Material identity, optional category/grade/specification/base-unit metadata, lifecycle, version, actor IDs, and timestamps.
- `ProductNameHistory` / `product_name_history` appends every actual canonical-name change with prior/new names, reason, actor, and timestamp.
- `modules/product.master/migrations/001_product_master.sql` owns both tables, indexes, constraints, and only same-owner feature references.
- The same code may exist in two organizations. All detail, list, history, update, archive, and restore operations filter by the authenticated actor's organization.

### UI

- A module-owned Product Master surface at `modules/product.master/web/src/moduleSurface.tsx`, composed only through the generated frontend catalog.
- Search, active/archived filtering, code/name sorting, resizable Product table, detail view, canonical-name history, create/edit popup, and archive/restore commands.
- `platform_admin`, `ops_manager`, and `trader` receive management controls; `finance_manager` and `viewer` remain read-only. Backend permissions remain authoritative.
- The UI uses only the existing nine-field neutral `ModuleSurfaceHostContext`; no shell field, shell state, or cross-feature import was added.

## Files Touched

| Area | Paths |
|---|---|
| Slice design/delivery | `docs/delivery/party-mdm-slice-design-2026-07-16.md`, this file |
| Module plan and catalog docs | `docs/modules/product.master/PRODUCT_MASTER_MODULE_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DOCUMENTATION_INDEX.md`, `docs/architecture/UOK_MODULE_ROADMAP.md`, `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md`, `modules/README.md` |
| Freeze/boundary truth | `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`, `ADR-0028-host-composition-and-neutral-module-surface-contracts.md`, `UOK_MODULE_EXTENSION_CONTRACT.md`, `UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md` |
| Product owner | `modules/product.master/manifest.yaml`, `backend/**`, `migrations/**`, `tests/**`, `verify/**`, `web/**` |
| Exact enforcement | `tests/module_public_api_contract.py`, `tests/test_module_public_api_boundaries.py`, `tests/kernel_host_backend_boundary_support.py`, `tests/test_kernel_host_backend_boundaries.py`, `modules/contacts.core/tests/test_module_catalog_baseline.py`, module/model/manifest/frontend/migration/verifier contract tests and fixtures |
| Generated contracts | `web/src/generated/openapi.json`, `openapi.d.ts`, `moduleSurfaceCatalog.ts`, `moduleSections.ts` |
| Migration ownership gate | `src/uok/migration_registry.py`, `tests/test_migration_discipline.py` |

## Freeze Compliance

**Yes.**

| Freeze rule | Evidence |
|---|---|
| Host stays composition-only | No Host production file changed. The only new module-to-Host imports are `get_db` and `current_actor` in `modules/product.master/backend/uok_product_master/_internal/delivery/api.py`; the exact allowlist is tested and now contains 29 symbol/path pairs. |
| Kernel stays stable | No file under `src/uok/kernel` or `src/uok/kernel_models.py` changed. |
| Feature behavior stays owner-local | Product behavior, ORM, migration, permissions, commands/events, UI, tests, and verifier all live under `modules/product.master`. |
| No foreign ORM/table access | Product imports no feature package, has no foreign feature FK/join/read/write, and claims only `ProductDefinition` and `ProductNameHistory` plus declared Kernel command/event scopes. |
| No facade bypass | The supported Python facade is exactly `api_router`, `command_handlers`, `command_permissions`, and `role_grants`; external private imports and Product frontend deep imports fail architecture tests. |
| Existing facades remain frozen | Planning remains 7 symbols and Contacts remains 8. Neither module's source, facade, mapping, or UI changed. |
| Shell stays one-way | The generated catalog is the only shell importer of `product.master/moduleSurface.tsx`; the module imports only neutral `@uok/contracts` and `@uok/shared` surfaces. |
| No split or Kernel growth | The already-approved `product.master` boundary in `UOK_PRODUCT_CARGO_SEPARATION_POLICY.md` was implemented as a new cohesive capability; no existing module was split. |
| Tenant/auth/audit preserved | Backend tests prove same-code multi-tenancy, cross-tenant 404/failed mutations, role denial, idempotency, expected versions, history, and event correlation. |

The Product HTTP adapter expands ADR-0028's exact in-process adapter surface from 27 to 29 imports. This is the Architecture Freeze rule-4/rule-7 new-module path, not an unfreeze: the two symbols are path-exact, tested, transport-only, and introduce no domain dependency.

## Tests And CI Status

Current local verification:

| Check | Result |
|---|---|
| Product backend/domain/integration/tenant suite | Pass: 11 tests |
| Product workbench Vitest plus module registry | Pass: 2 files / 13 tests |
| Focused Product + Gap 1–3 + manifest/model/migration/frontend architecture suite | Pass: 168 tests |
| Full Python repository runner | Pass: 120 / 120 discovered test files |
| Full frontend Vitest suite | Pass: 111 files / 404 tests |
| Static production frontend build | Pass |
| Generated OpenAPI/TypeScript/module catalog drift | Pass |
| Product TypeScript build | Pass |
| Repository `TechnologyAudit` and `Audit` gates | Pass |
| Repository `Verify` gate | Pass |
| Playwright UI proof | Pass: 19 tests; 1 intentional candidate-only skip |
| Release contract | Pass: 8 modules, 84 commands, 94 events |
| Runtime-proven verifier assets | Pass: 7 module verifiers |
| Rebuilt PostgreSQL candidate | Pass: healthy API plus live capacity policy |
| Full candidate verifier | Pass: all 7 module scenarios, including `product.master` |
| Hosted GitHub CI | Pending first publication of `feature/product-master-slice` |

No local gate is failing. The only pre-publication status is hosted GitHub CI, which cannot run until the branch exists on the remote.

## Manual Demo

1. Rebuild the local candidate:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
   ```

2. Open `http://127.0.0.1:18088`, sign in as an authorized operator, open Apps Manager, and install `product.master`.
3. Open **Product Master** and choose **New product**.
4. Create a representative definition such as code `RCN-RAW-001`, canonical name `Raw Cashew Nuts`, category `Commodity`, grade `Supplier Grade A`, and base unit `MT`.
5. Search for the code, open the detail, edit the canonical name with a reason, and confirm the Name history entry shows prior/new names and reason.
6. Archive the definition, switch to **All products** or **Archived products**, restore it, and confirm its version and active status advance.
7. For repeatable API/runtime proof, run `modules/product.master/verify/UokCandidateProductMaster.ps1` through the repository candidate verifier.

## Residual Risks

- Product aliases, dedupe/merge, bulk import/export, controlled grade/unit taxonomies, and HS-code governance are intentionally absent.
- No Product reference DTO is published for another feature yet. The freeze requires a real Cargo, Planning, or Intelligence caller before adding that public symbol.
- Archive retains data and name history; hard purge is deliberately not available.
- Static analysis retains the accepted raw-SQL/reflection/computed-import blind spots. Product production code uses none of those mechanisms.

## Next Recommended Slice

Implement a tenant-scoped **Location Master** registry next, limited to canonical location code/name/type/country and recoverable lifecycle—without Route topology yet. This is the next smallest export-import MDM need, and Planning already reserves an unavailable `locations.core` / `location.provider` boundary. Keep any later Planning resolver as a separate owner-DTO integration slice so Location remains independently owned and no cross-module table access is introduced.

## Validation

The full commands in `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md` passed. The repository-required `TechnologyAudit`, `EngineeringEvidence`, `Audit`, `Rebuild`, and `Verify` operations also passed. The rebuilt candidate exposed both Product owner tables and the full candidate verifier proved the Product Definition lifecycle against PostgreSQL. Hosted CI remains the final publication gate.
