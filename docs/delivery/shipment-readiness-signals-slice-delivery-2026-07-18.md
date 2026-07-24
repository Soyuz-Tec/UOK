# Shipment Readiness Signals Slice Delivery – 2026-07-18

**Status:** Locally and hosted qualified; published as stacked draft PR
[#73](https://github.com/Soyuz-Tec/UOK/pull/73).

**Candidate:** `UOK-3.1.0-alpha.3`

**Hosted-qualified code head:**
`cf89e9b555805c8219f549d972003f0329574a81`

**Exact rebuilt implementation commit:**
`887e49f3a6910374c8f8af560ef11397134d5ce5`

**Stacked prerequisite:** draft PR
[#72](https://github.com/Soyuz-Tec/UOK/pull/72) at
`2c9831b041bd3a54de11be10ed58c476a95706f0`; both its push and
pull-request candidate checks are green.

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
| Full TechnologyAudit / EngineeringEvidence / Audit | Pass; EngineeringEvidence captured clean exact source at `887e49f` |
| PostgreSQL Rebuild / Verify / all 12 candidate verifiers | Pass; exact API image `1800a128ae4613563ab4b7fc588f0652309b48406eb59b6c84fb348ce212b062` |
| Live desktop and 375 CSS-pixel browser proof | Pass; no horizontal overflow, mutation controls, or console errors |
| GitHub preflight and stacked draft PR | Pass; PR #73 targets prerequisite branch from PR #72 |
| Exact-head hosted CI | Pass at `cf89e9b`; pull-request run `30065228009` and push rerun `30065226191` attempt 2 |

### Exact-Source Qualification Evidence

The clean qualification worktree was
`C:\Users\vasan\OneDrive\Documents\UOK-readiness-qualification` on
`qualification/shipment-readiness-signals`, with exact HEAD `887e49f` and zero
dirty paths. Sanitized local engineering evidence was generated at
`var/evidence/engineering/uok_engineering_20260724T021313Z.json`; `var/`
remains local-only.

The full local gate completed with:

- all 158 unique Python test files passing;
- clean Python and npm dependency audits;
- generated OpenAPI, TypeScript, and frontend-module catalogs matching source;
- all release, public-facade, physical-boundary, naming, source-size, and
  final-image gates passing;
- 133 frontend test files / 487 tests passing;
- TypeScript and Vite production build passing, with only the existing
  non-blocking bundle-size warning;
- 19 Playwright scenarios passing and one expected live-only scenario skipped;
  and
- all 12 authenticated candidate verifiers passing.

`Rebuild` produced exact API image
`1800a128ae4613563ab4b7fc588f0652309b48406eb59b6c84fb348ce212b062`.
The rebuilt candidate returned HTTP 200 from `/health` with status `ok`,
version and target version `UOK-3.1.0-alpha.3`. Offline and live database
capacity checks both passed.

The Shipment Readiness verifier proved the exact transition
`ready -> attention_required -> ready`, while the Shipment remained `closed`
at header version `6`. Viewer read access and fail-closed module disablement
also passed.

### Exact-Head Hosted CI Evidence

The two changes after the rebuilt implementation commit affect only the
Shipment Readiness session test:

- `fa8d5789c34398afa5374d2ad8a1d105282dac30` qualifies browser storage
  through `window`; and
- `cf89e9b555805c8219f549d972003f0329574a81` clears the temporary storage
  before Vitest restores its globals.

No production source changed. The corrected session suite passed all six tests
under both local Node 24 and Node 26 before publication.

Both hosted events are green on exact head `cf89e9b`:

- pull-request run
  [`30065228009`](https://github.com/Soyuz-Tec/UOK/actions/runs/30065228009),
  job
  [`89394746811`](https://github.com/Soyuz-Tec/UOK/actions/runs/30065228009/job/89394746811);
  and
- push run
  [`30065226191`](https://github.com/Soyuz-Tec/UOK/actions/runs/30065226191)
  attempt 2, job
  [`89400162433`](https://github.com/Soyuz-Tec/UOK/actions/runs/30065226191/job/89400162433).

The first push attempt passed the Shipment Readiness suite but hit one
unrelated Compliance lifecycle UI timing failure. The same exact head passed
that test in the pull-request event, and the failed-job push rerun passed
without a source change.

### Live Browser Evidence

The in-app browser exercised the rebuilt candidate through the real UI. A
temporary Shipment `UI-PROOF-SHIPMENT-20260717` was first shown as `ready`,
then as `attention_required` after an owner-authorized required document was
left missing, and finally as `ready` after that requirement was received. Its
Shipment header remained `planned` at version `3`.

The same browser session also proved:

- exactly one grid row is tabbable, with Arrow, Home, and End moving both focus
  and selection;
- the `ready` filter returned only Ready rows;
- the owner-supplied Open Shipment link remained same-origin and carried the
  exact Shipment ID;
- the UI exposed no mutation controls;
- at 375 by 812 CSS pixels, root and body client/scroll widths remained equal
  at 360 pixels with no document-level horizontal overflow; and
- the browser console contained zero errors.

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

The recommended next product slice, **bounded document-expiry readiness**, now
has an approved explicit-as-of, fixed-UTC v1 policy and inclusive
30-calendar-day warning horizon in
`docs/delivery/shipment-document-expiry-readiness-slice-design-2026-07-23.md`.
Its implementation and qualification record is
`docs/delivery/shipment-document-expiry-readiness-slice-delivery-2026-07-23.md`.
It remains read-only and must not add a score, prediction, persisted
Intelligence state, workflow mutation, file access, or raw foreign data access.
