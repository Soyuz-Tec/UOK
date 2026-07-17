# Location Master Slice Delivery – 2026-07-16

**Status:** Locally qualified; stacked draft pull request and hosted CI pending.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/location-master-slice-design-2026-07-16.md`

## What Shipped

UOK now has one tenant-scoped Location Master capability in `locations.core`:

- canonical Location Definitions for operational `port`, `warehouse`, `city`, and `region` records;
- normalized immutable organization-unique codes and normalized two-letter country linkage;
- create, update, recoverable archive, and restore commands with optimistic versions;
- append-only canonical-name history when the actual name changes;
- actor-authorized organization-scoped list, detail, and history reads;
- immutable, serialization-safe HTTP response DTOs with no organization or ORM object leakage;
- normal UOK command idempotency and correlated module-event audit evidence;
- a module-owned Location Master workbench for search/filter, detail/history, create, edit, archive, and restore;
- a closed manifest, owner migration, owner tests, exact boundary enforcement, generated contracts, and a runtime candidate verifier.

Party remains the golden identity owned by `contacts.core`. Location does not subsume Party addresses, read Product or Planning data, activate Planning's deferred provider, or implement Route/Corridor topology.

## API, Commands, And Data

### Public composition facade

`modules/locations.core/backend/uok_locations_core/public_api.py` exposes exactly:

1. `api_router`
2. `command_handlers`
3. `command_permissions`
4. `role_grants`

No ORM model, repository, service, session, or mutable entity is public. There is no speculative cross-module query symbol; the first real Route or Planning consumer must justify an immutable owner DTO through the freeze process.

### HTTP and command contract

- `GET /api/locations/definitions`
- `GET /api/locations/definitions/{location_definition_id}`
- `GET /api/locations/definitions/{location_definition_id}/name-history`
- `CreateLocationDefinition`
- `UpdateLocationDefinition`
- `ArchiveLocationDefinition`
- `RestoreLocationDefinition`
- `locations.read`
- `locations.manage`

### Owner data

`modules/locations.core/migrations/001_locations_core.sql` creates only:

- `location_definitions`
- `location_name_history`

The definition code is unique by `(organization_id, code)`. History has one same-owner foreign key to `location_definitions`; there are no Contacts, Product, Planning, Calendar, Reports, Route, shipment, or other feature foreign keys or joins.

## Files And Migrations Touched

| Area | Paths |
|---|---|
| Design and delivery | `docs/delivery/location-master-slice-design-2026-07-16.md`; `docs/delivery/location-master-slice-delivery-2026-07-16.md` |
| Module plan | `docs/modules/locations.core/LOCATION_MASTER_MODULE_PLAN.md` |
| Closed module contract | `modules/locations.core/manifest.yaml`; `modules/locations.core/README.md` |
| Private backend and facade | `modules/locations.core/backend/uok_locations_core/**` |
| Owner migration | `modules/locations.core/migrations/001_locations_core.sql`; `modules/locations.core/migrations/README.md` |
| Owner backend tests | `modules/locations.core/tests/test_location_master_domain.py`; `test_location_master_integration.py`; `test_location_master_tenant_isolation.py` |
| Owner frontend and tests | `modules/locations.core/web/src/**`; `modules/locations.core/tests/web/**` |
| Candidate verifier | `modules/locations.core/verify/UokCandidateLocationMaster.ps1`; `modules/locations.core/verify/README.md` |
| Architecture enforcement | `src/uok/migration_registry.py`; `tests/module_public_api_contract.py`; `tests/kernel_host_backend_boundary_support.py`; `tests/test_kernel_host_backend_boundaries.py`; `tests/test_module_public_api_boundaries.py`; `tests/test_module_model_registry.py`; `tests/test_migration_discipline.py`; `tests/test_module_physical_boundaries.py`; related manifest/verifier/frontend contract tests and registry fixtures |
| Generated contracts | `web/src/generated/openapi.json`; `web/src/generated/openapi.d.ts`; `web/src/generated/moduleSections.ts`; `web/src/generated/moduleSurfaceCatalog.ts`; `tests/fixtures/module_model_metadata.json` |
| Living architecture catalog | `docs/ARCHITECTURE.md`; `docs/DOCUMENTATION_INDEX.md`; `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`; `ARCHITECTURE-FREEZE-2026-07-16.md`; `UOK_MODULE_EXTENSION_CONTRACT.md`; `UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`; `UOK_MODULE_ROADMAP.md`; `modules/README.md` |

No dated re-audit, Planning implementation, Contacts implementation, Product implementation, Kernel contract, shell contract, or unrelated feature code was changed.

## Tenant And Audit Proof

- Every definition list/detail and mutation predicate includes the authenticated actor's `organization_id`.
- History requires both an organization-scoped owner lookup and an organization-scoped history query.
- Organization identity is never accepted from a request payload.
- Update/archive/restore use `(id, organization_id)` row locking plus `expected_version`.
- The database uniqueness boundary is `(organization_id, code)`, allowing the same normalized code in separate tenants.
- `modules/locations.core/tests/test_location_master_tenant_isolation.py` proves two organizations can reuse one code while all cross-tenant detail, history, update, archive, and restore attempts fail closed.
- `modules/locations.core/tests/test_location_master_integration.py` proves idempotency, permission denial, version conflicts, lifecycle filtering, rename-history rules, and correlated create/update/archive/restore events.

## Architecture Freeze Compliance

**Compliant:** Yes.

| Freeze rule | Evidence |
|---|---|
| Feature behavior stays in owner | `modules/locations.core/backend`, `web/src`, `migrations`, `tests`, and `verify` |
| Host remains composition only | Location API imports only exact allowlisted `uok.host.database.get_db` and `uok.host.security.current_actor` adapter seams |
| Kernel remains stable | No Kernel file or contract was added or widened |
| Narrow public API | Exact four-symbol facade enforced through `tests/module_public_api_contract.py` and `tests/test_module_public_api_boundaries.py` |
| No foreign ORM/table access | Location imports no feature owner; migration discipline reserves both Location tables against root/foreign module references |
| Shell remains neutral | `moduleSurface.tsx` is imported only by the generated catalog and receives the unchanged `ModuleSurfaceHostContext` |
| Planning/Contacts facades unchanged | No code or symbol change in either owner; Gap 1–3 frozen tests remain green |
| No module split or Kernel growth | One new evidence-backed capability module; no existing owner was split and no Kernel surface changed |

The accepted in-process Host adapter inventory increases from 29 to 31 exact imports because the one Location HTTP adapter uses the same two approved DI/auth seams as Product Master. ADR-0028 and the active freeze record this bounded addition; it creates no Host business logic, Kernel dependency, shell cycle, or cross-owner SCC.

## Verification And CI Status

Current local results:

| Gate | Result |
|---|---|
| Owner backend suite | Pass — 13 tests |
| Owner frontend + module surface registry | Pass — 13 tests |
| Frozen Gap 1–3 boundary command | Pass — 33 tests |
| Shared Location architecture/registry/migration suite | Pass — 69 tests |
| Generated OpenAPI and module catalogs | Pass — drift-free |
| Module release contract | Pass — 9 modules, 88 commands, 98 events, zero violations |
| Model registry | Pass — 53 mappings: 44 feature + 9 Kernel |
| Full `TechnologyAudit` | Pass |
| Full `EngineeringEvidence` | Pass — local evidence `var/evidence/engineering/uok_engineering_20260717T003900Z.json` |
| Full `Audit` | Pass — 123 unique Python test files plus dependency/contracts/release/source gates |
| Local candidate `Rebuild` | Pass — image built, PostgreSQL stack recreated, `/health` healthy, live capacity pass |
| Local candidate `Verify` | Pass — 123 Python files; 112 Vitest files / 413 tests; 19 Playwright tests passed and 1 intentionally skipped; 8/8 module verifiers passed |
| `locations.core` live verifier | Pass — install, create, detail, rename/history, archive filtering, restore, disable fail-closed, re-enable |
| Browser/runtime Location Master proof | Pass — generated navigation, tenant record/detail/history, create form, close/focus workflow, zero console warnings/errors |
| Pull request and hosted CI | Pending publication |

The local engineering-evidence artifact remains intentionally untracked. Hosted CI and pull-request review are still required before merge.

## Manual Demo

After the rebuilt candidate is healthy:

1. Open the UOK workspace and sign in as an operations manager, trader, or platform administrator.
2. Open **Location Master**; install or enable `locations.core` if its lifecycle card is shown.
3. Choose **New location** and create `NG-APAPA-PORT`, `Apapa Port`, type `Port`, country `NG`.
4. Search for the code, select the row, and confirm the detail shows type, country, lifecycle status, and version.
5. Choose **Edit**, rename it to `Port of Apapa`, supply a reason, and confirm the old/new names appear in **Name history**.
6. Archive the record and confirm it leaves the default Active view but appears in All/Archived; restore it and confirm it returns to Active.
7. Sign in as a viewer and confirm reads remain available while create/edit/archive/restore commands are absent.

## Residual Risks

- FastAPI session/auth injection remains an accepted in-process Host adapter seam; extraction would replace the adapter without changing Location domain behavior.
- Static enforcement cannot prove every computed import, reflection call, or dynamically assembled SQL string; no such mechanism is used in this slice, and review plus migration/AST gates remain required.
- `country_code` is deliberately syntactic. It does not verify a global ISO, customs, port, or geopolitical catalog.
- Planning's `location.provider` remains unavailable by design until a real consumer slice defines an immutable owner query contract.

No P0 architecture, tenancy, authorization, or data-ownership residual is currently known.

## Recommended Next Slice

The next evidence-backed vertical slice is a small tenant-scoped **Route/Corridor Definition** owner, not an expansion of Location Master. Planning already stores typed Location references and reserves the `locations.core` owner, while the completed Product and Location masters now provide stable identities needed by an RCN export-import corridor. The Route slice should begin only after the product team locks the minimum route facts and real caller; it should own route topology, reference Location IDs through a new immutable owner DTO/API justified by that caller, and avoid foreign keys or joins to Location, Party, Product, or Planning tables. Compliance Document Type or Intelligence Signals should take priority instead if an operating workflow supplies stronger immediate evidence.
