# Shipment Readiness Signals Module Plan

**Module:** `intelligence.core`

**Target candidate:** `UOK-3.1.0-alpha.3`

**Status:** Base slice and bounded document-expiry readiness are runtime and
hosted qualified; further Intelligence product work is not selected.

**Source root:** `modules/intelligence.core`

## Purpose And Authority

`intelligence.core` is the optional read-only Intelligence capability for
deterministic operational signals derived from immutable owner facts. Its base
slice interprets Shipment-owned document readiness without becoming a second
Shipment source of truth. Its bounded expiry extension evaluates current
document-instance expiry against an explicit date without introducing a clock,
state, prediction, or workflow authority.

Detailed design and delivery evidence:

- `docs/delivery/shipment-readiness-signals-slice-design-2026-07-18.md`
- `docs/delivery/shipment-readiness-signals-slice-delivery-2026-07-18.md`
- `docs/delivery/shipment-document-expiry-readiness-slice-design-2026-07-23.md`
- `docs/delivery/shipment-document-expiry-readiness-slice-delivery-2026-07-23.md`

Architecture authority remains:

- `docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`;
- `docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`;
- `docs/architecture/UOK_MODULE_EXTENSION_CONTRACT.md`; and
- `docs/architecture/UOK_MODULE_MANIFESTS_AND_BOUNDARIES.md`.

## Base Slice

The base slice owns:

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

## Bounded Document-Expiry Slice

The expiry extension keeps the same API, bands, permission, workbench, owner
facade, and stateless architecture. It adds:

- a required explicit `as_of=YYYY-MM-DD` on every read;
- a fixed `UTC` v1 evaluation-time-zone policy because UOK currently owns no
  organization or tenant time-zone setting;
- an inclusive 30-calendar-day warning horizon;
- recorded/verified current-instance eligibility;
- expired, expiring-soon, missing-expiry, and next-current/future expiry
  owner aggregates;
- fixed expired, expiring-soon, and informational missing-expiry reasons; and
- a visible **As of (UTC)** workbench control that is sent on every request.

Expired means `expires_on < as_of`. Expiring soon means
`as_of <= expires_on <= as_of + 30 calendar days`. Null expiry on an eligible
instance is informational and never changes a band by itself. Rejected
instances retain the base attention rule; draft and superseded instances are
excluded from expiry evaluation.

Configurable tenant time zones remain deferred to a separate decision and
migration as applicable.

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
aggregate requirement and document-instance counts. For expiry evaluation, the
resolver also receives the explicit `as_of` and inclusive
`expiring_soon_through` dates and returns:

- `document_instance_expiry_evaluated`;
- `document_instance_expiry_not_recorded`;
- `document_instance_expired`;
- `document_instance_expiring_soon`; and
- `next_document_expiry_on`.

The evaluated count includes every current recorded/verified instance,
including eligible rows with null expiry. The next expiry is the earliest
eligible non-null date on or after `as_of`; expired dates are excluded, and it
is null if no current/future eligible expiry remains.

The DTO does not expose requirement IDs, document-instance IDs, Compliance
type IDs, Party IDs, Location IDs, Route IDs, document numbers, issuer values,
notes, ORM objects, repositories, or SQL expressions.

Shipment independently enforces:

- `shipments.read`;
- `shipments.core` operational state;
- `actor.organization_id`; and
- redacted denied, missing, and unavailable responses.

Planning's existing Shipment reference contract is unchanged.

## Signal Rules

| Band | Rule |
|---|---|
| `attention_required` | One or more required documents are missing; one or more current instances are rejected; or one or more eligible current instances are expired or expire within the inclusive 30-day horizon |
| `not_assessed` | Otherwise, no required Document Types are defined |
| `ready` | Otherwise: required Document Types are defined, none are missing, and no rejected, expired, or expiring-soon instance is present |

Reason codes explain the calculation. Requirement satisfaction remains the
Shipment-owned formula `received + waived + not_applicable`.

Draft, recorded, verified, and superseded instance counts remain explanatory.
The fixed expiry reasons are `expired_document_present`,
`expiring_document_present`, and informational
`document_expiry_not_recorded`. Shipment lifecycle is context only.
Intelligence never changes Shipment, requirement, or instance state and never
blocks a movement transition.

## Public And UI Contracts

- List API:
  `/api/intelligence/shipment-readiness?as_of=YYYY-MM-DD` (`as_of` required)
- Permission: `intelligence.read`
- Workbench section: `intelligence`
- Python facade: exact `api_router` and `role_grants` composition hooks

The frontend calls only the Intelligence API and imports no Shipment frontend
source. It uses only the neutral module-surface contract and shared UOK
workspace primitives. The visible as-of date is labeled UTC and included in
every initial, manual-refresh, and host-refresh request.

## Data And Integrity Rules

- Every result is derived at request time from one Shipment owner facade call
  using the request's explicit `as_of` and inclusive through-date.
- The server has no hidden current-date default and does not infer a tenant
  time zone.
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
requirement updates, configurable tenant time zones, per-Document-Type legal
expiry requirements, route risk, ETA, anomaly detection, optimization,
forecasting, recommendations, confidence, probability, ML/LLM inference,
Oracle runtime naming, notifications, scheduled evaluation, persisted signal
history, data warehouse, file storage, customs integration, Planning/Contacts
changes, Kernel growth, and shell-contract changes.

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
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify_uok_candidate_isolated.ps1
```

Runtime acceptance additionally requires:

- rebuilt PostgreSQL candidate and `/health`;
- all 12 authenticated module verifiers;
- browser proof at desktop and 375 CSS pixels;
- zero browser console errors;
- GitHub preflight/readiness;
- a stacked draft pull request; and
- green hosted CI at the exact final head.

## Selected Next Increment

Bounded document-expiry readiness is qualified. The selected next bounded
increment is UOK-wide `Candidate Data Neutrality v1`, not an Intelligence
feature expansion.

The Intelligence candidate scenario and its Shipment-owner setup must leave no
user-visible or recoverable Shipment, requirement, document-instance, or
readiness proof fixture after success or failure. Cleanup must preserve the
primary verification error and report cleanup failures separately. Ordinary
recoverable lifecycle transitions do not satisfy zero retention. Historical
cleanup requires an exact reviewed ID list, a SHA-256 digest of the sorted IDs,
explicit exclusions, and post-cleanup proof.

Further Intelligence work will be chosen from clean operator evidence after
the repeated-run zero-delta gate passes. Configurable tenant time zones are not
an incremental UI option; they require an owned setting, authorization and
compatibility rules, a separate decision, and migration as applicable. Large
tenant volumes may justify pagination or an owner-owned read model after
measurement. Do not add a score, model, prediction, persistence layer,
notification scheduler, or workflow mutation merely to make the Intelligence
module appear broader.
