# Shipment Readiness Signals Module Plan

**Module:** `intelligence.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Active first-slice implementation and qualification plan.

**Source root:** `modules/intelligence.core`

## Purpose And Authority

`intelligence.core` is the optional read-only Intelligence capability for
deterministic operational signals derived from immutable owner facts. Its first
slice interprets Shipment-owned document readiness without becoming a second
Shipment source of truth.

Detailed design and delivery evidence:

- `docs/delivery/shipment-readiness-signals-slice-design-2026-07-18.md`
- `docs/delivery/shipment-readiness-signals-slice-delivery-2026-07-18.md`

Architecture authority remains:

- `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`;
- `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`;
- `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`; and
- `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`.

## First Slice

The first slice owns:

- one tenant-scoped Shipment Readiness HTTP read model;
- deterministic `attention_required`, `not_assessed`, and `ready` bands;
- fixed explanatory reason codes;
- a read-only operator workbench with search, band filters, list/detail, and a
  safe owner-provided Shipment link;
- `intelligence.read` role grants;
- module-owned backend/frontend tests; and
- an authenticated candidate verifier.

The slice contains no predictive model, score, probability, confidence,
recommendation, or workflow action.

## Ownership

| Surface | Owner |
|---|---|
| Manifest and lifecycle contract | `modules/intelligence.core/manifest.yaml` |
| Signal derivation and HTTP response | `modules/intelligence.core/backend/uok_intelligence_core` |
| Schema-change declaration | `modules/intelligence.core/migrations/README.md` |
| Backend and frontend tests | `modules/intelligence.core/tests` |
| Candidate verifier | `modules/intelligence.core/verify` |
| Production React and CSS | `modules/intelligence.core/web/src` |
| Source facts and audit history | `shipments.core` |
| Compile-time shell composition | Validated manifest and generated module-surface catalog |

The module is intentionally stateless. It has no ORM mapping, SQL migration,
table, cache, command, event, model export, or manage permission.

## Shipment Owner Contract

`intelligence.core` may import exactly:

- `ShipmentReadinessSnapshotDTO`; and
- `resolve_shipment_readiness_snapshots`

from `uok_shipments_core.public_api`.

The owner DTO contains only actor-visible Shipment identity/navigation plus
aggregate requirement and document-instance counts. It does not expose
requirement IDs, document-instance IDs, Compliance type IDs, Party IDs,
Location IDs, Route IDs, document numbers, issuer values, notes, ORM objects,
repositories, or SQL expressions.

Shipment independently enforces:

- `shipments.read`;
- `shipments.core` operational state;
- `actor.organization_id`; and
- redacted denied, missing, and unavailable responses.

Planning's existing Shipment reference contract is unchanged.

## Signal Rules

| Band | Rule |
|---|---|
| `attention_required` | One or more required documents are missing, or one or more current document instances are rejected |
| `not_assessed` | No required Document Types are defined and no attention condition applies |
| `ready` | Required Document Types are defined, none are missing, and no rejected instance is present |

Reason codes explain the calculation. Requirement satisfaction remains the
Shipment-owned formula `received + waived + not_applicable`.

Draft, recorded, verified, and superseded instance counts are explanatory.
Shipment lifecycle is context only. Intelligence never changes Shipment,
requirement, or instance state and never blocks a movement transition.

## Public And UI Contracts

- List API: `/api/intelligence/shipment-readiness`
- Permission: `intelligence.read`
- Workbench section: `intelligence`
- Python facade: exact `api_router` and `role_grants` composition hooks

The frontend calls only the Intelligence API and imports no Shipment frontend
source. It uses only the neutral module-surface contract and shared UOK
workspace primitives.

## Data And Integrity Rules

- Every result is derived at request time from one Shipment owner facade call.
- Intelligence stores no copy of an owner fact.
- Denied, missing, and unavailable source records cannot become readiness
  bands.
- Cross-tenant Shipments never enter tenant list mode.
- No foreign ORM import, table name, FK, join, raw SQL, reflection, metadata
  access, repository, schema, or migration is allowed.
- No reverse dependency from Shipment to Intelligence is allowed.
- No direct Intelligence dependency on Compliance, Contacts, Location, Route,
  Product, Planning, Reports, Calendar, Communications, or Agents is allowed.
- Existing Shipment histories remain the audit truth.

## Non-Goals

Shipment workflow blocking, status hints that mutate state, automated
requirement updates, expiry policy, expiring-soon horizons, route risk, ETA,
anomaly detection, optimization, forecasting, recommendations, confidence,
probability, ML/LLM inference, Oracle runtime naming, notifications, scheduled
evaluation, persisted signal history, data warehouse, file storage, customs
integration, Planning/Contacts changes, Kernel growth, and shell-contract
changes.

## Qualification

Before promotion:

```powershell
python -m pytest -q -p no:cacheprovider modules/intelligence.core/tests --ignore=modules/intelligence.core/tests/web
python -m pytest -q -p no:cacheprovider modules/shipments.core/tests/test_shipment_readiness_snapshot_api.py tests/test_intelligence_shipment_data_boundary.py
python -m pytest -q -p no:cacheprovider tests/test_planning_data_boundary.py tests/test_module_public_api_boundaries.py tests/test_kernel_host_backend_boundaries.py tests/test_kernel_host_shell_boundaries.py
python scripts/quality_audit.py
python scripts/run_python_tests.py
npm --prefix web run check:contracts
npm --prefix web test
npm --prefix web run build:static
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate.ps1
```

Runtime acceptance additionally requires:

- rebuilt PostgreSQL candidate and `/health`;
- all 12 authenticated module verifiers;
- browser proof at desktop and 375 CSS pixels;
- zero browser console errors;
- GitHub preflight/readiness;
- a stacked draft pull request; and
- green hosted CI at the exact final head.

## Next Slice Boundary

After this deterministic read-only slice is qualified, the next product work
should be chosen from actual operator evidence. A likely follow-up is bounded
expiry/expiring-soon readiness, but only after an explicit as-of date,
tenant-time-zone rule, and reviewed horizon exist. Do not add a score, model,
prediction, persistence layer, or workflow mutation merely to make the
Intelligence module appear broader.
