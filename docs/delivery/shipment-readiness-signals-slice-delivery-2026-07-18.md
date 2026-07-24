# Shipment Readiness Signals Slice Delivery – 2026-07-18

**Status:** Implemented; final candidate and hosted-CI qualification in
progress.

**Candidate:** `UOK-3.1.0-alpha.3`

**Design authority:**
`docs/delivery/shipment-readiness-signals-slice-design-2026-07-18.md`

## What Shipped

The first `intelligence.core` product slice delivers a tenant-scoped,
read-only Shipment Readiness workbench. It derives deterministic advisory
signals from Shipment-owned requirement and document-instance counts:

- `attention_required` when a required document is missing or a current
  document-instance record is rejected;
- `not_assessed` when no required Document Types are defined and no attention
  condition applies; and
- `ready` when required document metadata is defined and satisfied with no
  rejected instance.

The module exposes `GET /api/intelligence/shipment-readiness`, fixed reason
codes, owner counts, and a safe owner-authorized Shipment link. Its React
surface provides search, band filtering, Refresh, an accessible resizable
table, a detail pane, responsive layout, and read-only module-state handling.
It has no score, prediction, recommendation, workflow command, persisted
signal, cache, file control, or Oracle/model runtime.

## Shipment Owner API

The real Intelligence caller justifies widening
`modules/shipments.core/backend/uok_shipments_core/public_api.py` from six to
eight exact symbols:

- frozen `ShipmentReadinessSnapshotDTO`; and
- `resolve_shipment_readiness_snapshots(db, actor, shipment_ids=None)`.

The owner resolver queries only current Shipment-owned rows in `shipments`,
`shipment_document_requirements`, and `shipment_document_instances`. It
enforces `shipments.read`, Shipment operational state, and
`actor.organization_id`, then returns immutable aggregate value data.

List mode returns only tenant-visible Shipments in deterministic order.
Permission denial and provider unavailability fail closed; an authorized empty
tenant remains distinguishable as an empty tuple. Explicit-ID mode preserves
order and duplicates and redacts denied, missing, or unavailable facts to
`None`.

No requirement ID, document-instance ID, Compliance Type ID, Party/Location/
Route ID, document number, issuer, note, ORM object, repository, or SQL
expression crosses the facade.

## Intelligence Ownership And Data

`modules/intelligence.core` owns:

- the deterministic advisory policy and fixed reason codes;
- the read-only HTTP adapter and frozen response schemas;
- `intelligence.read` grants;
- the module-owned React/CSS workbench;
- backend, tenant, frontend, and architecture tests; and
- the authenticated candidate verifier.

The module owns no table or row. Its empty schema-change declaration is
`modules/intelligence.core/migrations/README.md`; there is no SQL migration,
ORM mapping, `model_exports`, command, event, cache, or new Kernel contract.

## Files And Generated Contracts

### New owner files

- `modules/intelligence.core/manifest.yaml`
- `modules/intelligence.core/README.md`
- `modules/intelligence.core/backend/**`
- `modules/intelligence.core/migrations/README.md`
- `modules/intelligence.core/tests/**`
- `modules/intelligence.core/verify/**`
- `modules/intelligence.core/web/src/**`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/readiness_snapshot_read_service.py`
- `modules/shipments.core/backend/uok_shipments_core/_internal/delivery/readiness_snapshot_service.py`
- `modules/shipments.core/tests/test_shipment_readiness_snapshot_api.py`
- `tests/intelligence_manifest_contract_assertions.py`
- `tests/intelligence_shipment_data_boundary_support.py`
- `tests/test_intelligence_shipment_data_boundary.py`

### Updated integration surfaces

- Shipment public facade and exact contract assertions;
- manifest, physical-boundary, Host-adapter, frontend-catalog, public-facade,
  and candidate-verifier architecture gates;
- generated module catalogs and OpenAPI/TypeScript contracts under
  `web/src/generated`;
- living architecture, freeze, roadmap, module-plan, and documentation-index
  records.

No migration registry, model fixture, Host source, Kernel source, command
registry, event registry, Planning facade, Contacts facade, shell port, CI
workflow, or deployment topology changed.

## DTO-Only And Freeze Proof

`modules/intelligence.core/backend/uok_intelligence_core/_internal/delivery/shipment_gateway.py`
imports exactly:

- `ShipmentReadinessSnapshotDTO`; and
- `resolve_shipment_readiness_snapshots`

from `uok_shipments_core.public_api`.

`tests/test_intelligence_shipment_data_boundary.py` rejects broad facade use,
Shipment internals, ORM models, table names, raw SQL, joins, reflection,
foreign keys, dynamic imports, every other feature dependency, reverse
Shipment imports, foreign frontend endpoints, and persistence declarations.
Planning's Shipment allowlist remains unchanged.

The slice preserves ADR-0028:

- Host remains composition, auth, and DB-session wiring only;
- Kernel receives no new symbol;
- one bounded read adapter adds only the already-allowlisted `get_db` and
  `current_actor` imports;
- current totals are 18 HTTP adapters / 39 exact Host imports, 12 candidate
  verifiers, and 11 frontend surfaces; and
- commands, events, and ORM mappings remain 108 / 118 / 64.

This is an accepted capability addition under the architecture freeze, not an
architecture unfreeze.

## Verification

| Gate | Result |
|---|---|
| Shipment and Intelligence focused backend/domain/tenant tests | Pass |
| Frozen Planning, Shipment, public-facade, Host/Kernel, shell, physical, manifest, catalog, and verifier boundary tests | Pass |
| Intelligence module frontend tests and central surface-registry test | Pass |
| Ruff and Python compile | Pass |
| Generated OpenAPI, TypeScript, and module catalogs | Pass |
| TypeScript and Vite production build | Pass; existing bundle-size warning only |
| Independent backend/architecture review | Pass after fail-closed list-mode correction; no remaining P0/P1 |
| Independent UI review | Pass after stale-data, module-action authorization, and tenant search-storage corrections; no remaining P0/P1 |
| Full TechnologyAudit / EngineeringEvidence / Audit | Pending final qualification |
| PostgreSQL Rebuild / Verify / all 12 candidate verifiers | Pending final qualification |
| Live desktop and 375 CSS-pixel browser proof | Pending final qualification |
| GitHub preflight, draft PR, and exact-head hosted CI | Pending publication |

## Candidate Verifier

`modules/intelligence.core/verify/UokCandidateShipmentReadiness.ps1` runs after
the Shipment dependency verifier and proves:

1. the satisfied Africa-to-V.O.C. candidate derives `ready`;
2. adding one missing required Document Type through Shipment's HTTP/command
   contract derives `attention_required`;
3. marking that requirement `received` derives `ready` again;
4. Shipment lifecycle and header version remain unchanged;
5. a viewer can read the signal; and
6. disabling `intelligence.core` closes its HTTP surface.

The verifier resolves the Document Type through Shipment's owner HTTP surface;
it never reads Compliance or Shipment ORM state.

## Manual Demo

1. Sign in to the rebuilt UOK candidate and install/enable
   `intelligence.core` as a platform administrator.
2. Complete the existing Shipment Support demo so the
   Africa-to-V.O.C./Thoothukudi-style Shipment has received or waived required
   metadata.
3. Open **Shipment Readiness** and confirm the Shipment is `ready`.
4. In Shipment Support, add the active Phytosanitary Certificate as a required
   document and leave it `missing`.
5. Return to Shipment Readiness, choose **Refresh**, and confirm
   `attention_required`, `required_documents_missing`, and the missing count.
6. Mark the Shipment-owned requirement `received`.
7. Refresh Shipment Readiness and confirm the same record returns to `ready`.
8. Open the Shipment through the owner-supplied link and confirm its movement
   lifecycle and header version did not change.
9. Verify search, band filters, keyboard row selection, viewer read-only
   behavior, and the narrow layout at 375 CSS pixels.

## Residual Risk And Next Slice

There is no P0 architecture or product residual in this bounded slice.
Signals are computed synchronously through an in-process Shipment adapter, the
accepted extraction seam documented by ADR-0028. Large future tenant volumes
may require explicit pagination or an owner-owned read model, but this slice
must not add persistence speculatively.

The recommended next product slice is **bounded document-expiry readiness**,
but only after product owners define an explicit as-of date, tenant time-zone
policy, and reviewed warning horizon. If those decisions are not ready, pause
structural work and prioritize Shipment/corridor operational polish from
operator evidence. Do not add a score, prediction, persisted Intelligence
state, or workflow mutation as a cosmetic follow-up.
