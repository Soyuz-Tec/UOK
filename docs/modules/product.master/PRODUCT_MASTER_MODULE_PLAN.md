# Product Master Module Plan

**Module:** `product.master`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active implementation and qualification plan.

**Source root:** `modules/product.master`

## Purpose And Authority

`product.master` is the optional, governed Product/Material master-data owner. It defines stable tenant-scoped product identity and lifecycle without owning cargo lots, commercial transactions, inventory, pricing, shipments, documents, routes, Parties, or engagement records.

The domain boundary follows `docs/architecture/UOK_PRODUCT_CARGO_SEPARATION_POLICY.md`: Product is canonical master data; Cargo is a later transactional aggregate that may reference Product through an explicit owner contract.

## First Slice

The 2026-07-16 slice owns:

- organization-unique immutable product codes;
- canonical names;
- optional category, grade, specification, and base-unit codes;
- create, governed update, archive, and restore commands;
- optimistic version checks for mutation safety;
- append-only canonical-name history;
- organization-scoped list, detail, and history reads;
- command/event audit correlation;
- a module-owned Product Master workbench;
- module lifecycle, candidate verification, and architecture-boundary evidence.

Detailed design and delivery evidence:

- `docs/delivery/party-mdm-slice-design-2026-07-16.md`
- `docs/delivery/party-mdm-slice-delivery-2026-07-16.md`

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/product.master/manifest.yaml` |
| Backend behavior and private ORM | `modules/product.master/backend/uok_product_master` |
| Schema changes | `modules/product.master/migrations` |
| Backend and frontend tests | `modules/product.master/tests` |
| Candidate verifier | `modules/product.master/verify` |
| Production React and CSS | `modules/product.master/web/src` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The module facade is intentionally limited to runtime composition providers. ORM mappings and implementation packages are private. No cross-module Product query API is published until a real owner-authorized caller exists.

## Data And Integrity Rules

- Every Product Definition belongs to exactly one organization.
- Product codes are normalized and unique only within that organization; the same code may exist in another tenant.
- Codes are immutable after creation so downstream references can remain stable.
- Canonical-name changes append history instead of overwriting the evidence trail silently.
- Updates, archive, and restore require the caller's current version and increment it on success.
- Archive is recoverable. No purge or hard delete is part of the first slice.
- All reads and mutations enforce authenticated actor organization and permission scope.
- Feature foreign keys, cross-module joins, foreign ORM imports, raw foreign-table access, and shared Product tables are forbidden.

## Public And UI Contracts

- Read API: `/api/products/definitions`
- Detail API: `/api/products/definitions/{product_definition_id}`
- Name history API: `/api/products/definitions/{product_definition_id}/name-history`
- Commands: `CreateProductDefinition`, `UpdateProductDefinition`, `ArchiveProductDefinition`, `RestoreProductDefinition`
- Permissions: `products.read`, `products.manage`
- Workbench section: `products`

The UI uses the existing neutral module-surface host contract. All Product DTOs, HTTP calls, command payloads, state, components, and CSS remain module-owned. The Product inspector uses an adaptive fact grid that collapses before values become unreadably narrow; long values wrap at word boundaries rather than one character at a time.

## Non-Goals

- Product aliases, merge/dedupe, bulk import/export, HS taxonomy, unit conversion, pricing, inventory, lots, shipments, or hard-coded commodity catalogs.
- Cargo, Party, supplier/buyer, Planning, Location/Route, Compliance, or Intelligence integration.
- Kernel contracts, Host business logic, shell contract changes, module splits, microservices, or runtime module loading.

## Qualification

Before promotion:

```powershell
python -m pytest modules/product.master/tests -q
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py tests/test_module_runtime_port.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate_isolated.ps1
```

Runtime changes additionally require a rebuilt local PostgreSQL candidate, authenticated Product Master verifier evidence, and a healthy `/health` response.

## Next Slice Boundary

The next Product Master increment should be chosen from measured operator need. Likely candidates are alias/dedup governance or an immutable Product reference DTO for the first real Cargo/Planning consumer. Cargo lifecycle, pricing, inventory, and transaction documents must remain separate owner capabilities.
