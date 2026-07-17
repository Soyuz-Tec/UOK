# Shipment Support Slice Delivery – 2026-07-17

**Status:** Delivered in stacked draft PR [#65](https://github.com/Soyuz-Tec/UOK/pull/65); local qualification and hosted code-bearing CI are green.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Design authority:** `docs/delivery/shipment-support-slice-design-2026-07-17.md`

## What Shipped

UOK now has a thin tenant-scoped operational Shipment capability in `shipments.core`:

- organization-unique immutable Shipment codes;
- required shipper and consignee Party references;
- required, distinct origin and destination Location references;
- an optional active Route/Corridor whose governed endpoints must match the Shipment;
- optional planned departure and arrival dates with date-order validation;
- a one-way `draft -> planned -> in_transit -> arrived -> closed` lifecycle, plus terminal cancellation from `draft` or `planned`;
- optimistic versions, append-only status-transition history, and correlated command/event evidence;
- organization-scoped list, detail, history, owner-option, and immutable stable-reference reads;
- fail-closed Party visibility that redacts denied private/team Party IDs from actor-facing Shipment DTOs, UI labels, and search values while preserving the stored stable references;
- a module-owned Shipment Support workspace for search/filter, list, detail, create, edit, legal reasoned status transitions, and Planning deep-link selection;
- a closed manifest, owner migration, owner tests, exact cross-owner enforcement, generated contracts, and a runtime candidate verifier.

The first slice intentionally has no Product/material line because Product Master exposes no immutable reference query API and Product is not needed for the corridor demo. It also excludes cargo lots, quantity/grade, booking, carriers, rates, tracking, documents, compliance packs, inventory, customs, payments, and intelligence.

## Files And Migration

| Area | Paths |
|---|---|
| Design and delivery | `docs/delivery/shipment-support-slice-design-2026-07-17.md`; `docs/delivery/shipment-support-slice-delivery-2026-07-17.md` |
| Module plan | `docs/modules/shipments.core/SHIPMENT_SUPPORT_MODULE_PLAN.md` |
| Closed module contract | `modules/shipments.core/manifest.yaml`; module-local README files |
| Private backend and facade | `modules/shipments.core/backend/uok_shipments_core/**` |
| Owner migration | `modules/shipments.core/migrations/001_shipments_core.sql`; migration README |
| Owner backend tests | `modules/shipments.core/tests/test_shipment_support_domain.py`; `test_shipment_support_integration.py`; `test_shipment_support_tenant_isolation.py`; `test_shipment_reference_api.py`; `shipment_test_support.py` |
| Owner frontend and tests | `modules/shipments.core/web/src/**`; `modules/shipments.core/tests/web/**` |
| Candidate verifier | `modules/shipments.core/verify/UokCandidateShipmentSupport.ps1`; verifier README |
| Repeatable lifecycle verification | `scripts/verify/UokCandidateHttp.ps1`; affected owner verifier scripts; `tests/test_candidate_verifier_paths.py` |
| Owner API extensions | `modules/routes.core/backend/uok_routes_core/public_api.py`; `modules/routes.core/tests/test_route_reference_api.py` |
| Planning adapter | `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py`; `modules/planning.core/tests/test_planning_shipment_links.py`; ADR-0004 |
| Architecture enforcement | `tests/test_shipment_foreign_data_boundary.py`; public-facade, Host allowlist, model registry/fixtures, migration, physical/manifest, verifier, and frontend catalog gates |
| Generated contracts | `web/src/generated/openapi.json`; `openapi.d.ts`; `moduleSections.ts`; `moduleSurfaceCatalog.ts` |
| Living architecture | `docs/ARCHITECTURE.md`; `docs/DOCUMENTATION_INDEX.md`; ADR-0028; active freeze; module extension/boundary/roadmap/Product-Cargo policy docs; `modules/README.md` |

`modules/shipments.core/migrations/001_shipments_core.sql` creates only:

- `shipments`
- `shipment_status_history`

The only feature-local foreign key is status history to its owning Shipment. Party, Location, and Route IDs are plain bounded stable IDs with no foreign feature key or database join.

## Public API Symbols

### Shipment owner facade

`modules/shipments.core/backend/uok_shipments_core/public_api.py` exposes exactly:

1. `ShipmentReferenceDTO`
2. `api_router`
3. `command_handlers`
4. `command_permissions`
5. `resolve_shipment_reference`
6. `role_grants`

The frozen reference DTO contains only stable Shipment value data and a neutral open path. Closed and cancelled records remain valid historical references; permission, tenant, missing-record, and module-lifecycle states fail closed.

### Route owner facade additions

The real Shipment caller adds exactly:

1. `RoutePathReferenceDTO`
2. `resolve_route_path_references`

The frozen DTO exposes ordered stable Location IDs but no Route/Stop ORM object, repository, SQLAlchemy expression, or tenant object. The existing six Route facade symbols remain compatible.

No Planning, Contacts, Product, or Location facade was widened.

## Foreign-API-Only Proof

| Consumer | Owner facade used | Production gateway / call site |
|---|---|---|
| Shipment -> Contacts | `PartyReferenceResolution`, `resolve_party_reference` | `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/party_gateway.py` |
| Shipment -> Location | `LocationReferenceResolution`, `resolve_location_references` | `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/location_gateway.py` |
| Shipment -> Route | `RoutePathReferenceDTO`, `resolve_route_path_references` | `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/route_gateway.py` |
| Planning -> Shipment | `resolve_shipment_reference` returning `ShipmentReferenceDTO` | `modules/planning.core/backend/uok_planning_core/_internal/coordination/link_resolver.py` |

`tests/test_shipment_foreign_data_boundary.py` AST- and SQL-scans Shipment production code and its migration. It rejects foreign root/facade-object/wildcard/private/dynamic imports, owner ORM/repository/schema/table tokens, raw SQL, reflection/metadata escape hatches, and feature foreign keys for Contacts, Product, Location, and Route.

`tests/test_planning_data_boundary.py` independently permits only the exact Shipment facade resolver and still rejects every Shipment internal/data import from Planning. `tests/test_module_public_api_boundaries.py`, model metadata, and migration-discipline gates provide separate facade and table-ownership proof.

## Tenant And Lifecycle Proof

- Every Shipment list/detail/history, update, and transition predicate includes authenticated `organization_id`.
- Request and public DTOs never accept or expose organization identity.
- Two tenants may reuse one Shipment code; foreign Shipment, Party, Location, and Route IDs resolve as missing/denied and cannot be persisted.
- When Contacts denies private/team Party visibility, Shipment read DTOs return `null` for the corresponding actor-facing Party ID and the UI renders only a restricted label; `modules/shipments.core/tests/test_shipment_party_visibility.py` proves the persisted owner reference remains unchanged.
- Header updates and transitions select by `(id, organization_id)` under an optimistic expected version.
- Owner resolution uses the same immutable actor and fails closed when a reference is foreign, inactive, missing, denied, or its provider is disabled.
- A Route write succeeds only when its ordered first/last Location IDs match the Shipment endpoints.
- Every status transition appends same-owner immutable history and emits correlated evidence.

## Architecture Freeze Compliance

**Compliant:** Yes.

| Freeze rule | Evidence |
|---|---|
| Feature behavior stays in owner | `modules/shipments.core/backend`, `web/src`, `migrations`, `tests`, and `verify` |
| No foreign data access | Exact named immutable owner facade calls plus `tests/test_shipment_foreign_data_boundary.py` |
| Host remains composition only | Shipment HTTP adapter imports only allowlisted `get_db` and `current_actor`; exact Host adapter inventory is 35 |
| Kernel remains stable | No Kernel file, port, mapping, helper, permission, or allowlist was added |
| Narrow public APIs | Exact six-symbol Shipment and eight-symbol Route facades are contract-tested |
| Planning/Contacts stay narrow | Neither public facade changed; Planning's private typed-link adapter calls only Shipment public API |
| Shell remains neutral | Shipment surface is owner-local and composed only by the generated catalog through unchanged `ModuleSurfaceHostContext` |
| Owner data is isolated | Two Shipment mappings bring the registry to 58 total: 49 feature-owned plus nine Kernel; no foreign feature FK |

ADR-0028 and the active freeze record the Shipment HTTP adapter's two accepted in-process Host seams, increasing the exact allowlist from 33 to 35 without changing Host responsibilities. No new Kernel dependency, shell backedge, foreign ORM edge, or cross-owner SCC was introduced.

## Verification, CI, And PR Status

Current completed local evidence:

| Gate | Result |
|---|---|
| Route path facade tests | Pass — 2 tests |
| Shipment owner backend suites | Pass — 14 tests, including denied private/team Party-ID redaction |
| Planning -> Shipment integration | Pass — 1 test |
| Shipment foreign-data boundary | Pass — 24 tests |
| Focused frozen architecture/model/migration gates | Pass |
| Python compilation | Pass |
| Generated OpenAPI and module catalogs | Pass — drift-free |
| Container verifier assets | Pass — 10 runtime-proven verifier assets |
| Module-owned and full frontend tests | Pass — 116 files / 434 tests |
| Production TypeScript/Vite client build | Pass |
| TechnologyAudit | Pass — zero hard violations; pre-existing Calendar/Contacts soft review warnings only |
| EngineeringEvidence | Pass — local ignored artifact `var/evidence/engineering/uok_engineering_20260717T150455Z.json` |
| Full Audit | Pass — 137/137 Python test files; Python/frontend dependency audits clean; contract/release/source/size/folder gates green |
| Local candidate Rebuild | Pass — exact-source image `181f71137db8e339278557169c65075516c9b80d8d758bbfb356bf6c6e8a1d77`; API health and offline/live database capacity green |
| Local candidate Verify and Shipment verifier | Pass — 137/137 Python files, 116 frontend files / 434 tests, production build, Playwright 19 pass + 1 environment-gated skip, and all 10 owner verifiers green on the rebuilt image; verifier repeatability was also proven twice against the persistent database |
| Browser Shipment proof | Pass — created `UI-PROOF-SHIPMENT-20260717`, resolved owner DTOs, changed governed Route/endpoints, advanced Draft -> Planned with reason/history/version, no console warnings/errors, and no horizontal overflow at 375px |
| Draft PR / hosted CI | Pass — stacked draft PR [#65](https://github.com/Soyuz-Tec/UOK/pull/65); code-bearing head `11aafab` passed [Unified Operating Kernel CI #543](https://github.com/Soyuz-Tec/UOK/actions/runs/29599618566) |

The module release contract totals are 11 modules, 95 commands, and 105 events. The only warning retained by final local qualification is the existing recommendation to use a least-privileged local PostgreSQL application role instead of the current development superuser.

## Manual Demo

1. Sign in as an operations manager, trader, or platform administrator.
2. In Contacts, create or identify active RCN shipper and consignee Parties and copy their stable IDs.
3. In Location Master, create or reuse an Africa origin port and the V.O.C./Thoothukudi destination port.
4. In Route/Corridor Master, create or reuse a sea corridor whose first/last Locations match those endpoints.
5. Install `shipments.core` and open **Shipment Support**.
6. Create `RCN-AFRICA-VOC-001` with the Party IDs, origin/destination, optional governed Route, and planned dates.
7. Inspect resolved owner labels and the ordered corridor; edit a planned date while the Shipment is `draft`.
8. Transition `draft -> planned -> in_transit -> arrived -> closed`, supplying a reason each time, then inspect version increments and append-only status history.
9. Add the Shipment ID as a Planning `shipment` link and use its open path; confirm Planning resolves `ready` and selects the exact Shipment without reading Shipment tables.
10. Sign in under another tenant and confirm the Shipment is absent; use a viewer role and confirm all mutation controls are absent.

## Residual Risks

- Party selection uses explicit stable IDs because Contacts intentionally exposes only a single-reference query and its frozen facade was not widened. The editor validates and renders those IDs through Contacts before save.
- FastAPI session/auth injection remains an accepted in-process Host adapter seam. Extraction would replace that adapter without changing Shipment domain behavior.
- Static enforcement cannot prove every computed string/import or native database extension. The slice uses none; AST, SQL, model-registry, review, and runtime gates remain required.
- Later owner archival does not rewrite historical Shipment IDs. Reads show the current owner status, while new writes require active references.
- The first slice has one header and no Shipment legs, Product line, cancellation after departure, exceptional movement workflow, or automated Planning decision.

No P0 architecture, tenancy, authorization, lifecycle, or data-ownership residual is currently known.

## Recommended Next Slice

A tenant-scoped **Compliance Document Type** registry is the best next slice. Shipment now supplies the first authoritative operational record that future document requirements can reference, but the repository still has no governed compliance-type vocabulary or document-pack owner. Define types and lifecycle first, then add Shipment document instances in a later slice through immutable owner IDs. Thin Intelligence Signals should follow only after Shipment/Compliance events provide stable evidence to score.
