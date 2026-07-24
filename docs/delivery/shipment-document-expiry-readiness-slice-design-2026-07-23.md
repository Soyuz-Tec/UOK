# Shipment Document Expiry Readiness Slice Design – 2026-07-23

**Status:** Approved implementation design.

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Extend Shipment Readiness with bounded, deterministic document
expiry signals evaluated from an explicit operator-visible date.

**Scope:** The immutable Shipment owner-facade facts, Intelligence derivation,
read-only HTTP response, module-owned workbench, tests, candidate evidence, and
rollback boundary for this slice.

**Architecture authority:**
`docs/architecture/ARCHITECTURE-FREEZE-2026-07-16.md`,
`docs/architecture/ADR-0028-host-composition-and-neutral-module-surface-contracts.md`,
and
`docs/delivery/shipment-readiness-signals-slice-design-2026-07-18.md`.

## 1. Decision

Extend the existing stateless `intelligence.core` Shipment Readiness slice to
identify tenant-visible Shipments that contain:

- a current document instance that is already expired;
- a current document instance that expires within the reviewed warning
  horizon; or
- a current document instance whose expiry date has not been recorded.

The extension remains synchronous, deterministic, read-only, and advisory.
`shipments.core` continues to own every document-instance row, date, status,
history, authorization decision, and tenant boundary. `intelligence.core`
receives only immutable aggregate values and derives the existing readiness
bands and fixed reason codes.

No score, probability, prediction, persistence, cache, command, event,
notification, workflow block, or mutation is introduced.

## 2. Evaluation Date And Time-Zone Policy

Every Shipment Readiness read requires an explicit `as_of` calendar date in
ISO `YYYY-MM-DD` form:

```http
GET /api/intelligence/shipment-readiness?as_of=2026-07-23
```

There is no server-side `today()` default. A missing or invalid query value is
rejected by the HTTP contract rather than silently evaluated against a
different date.

UOK does not currently own an organization or tenant time-zone setting.
Therefore this slice adopts `UTC` as the reviewed v1 evaluation-time-zone
policy for every tenant. The response echoes that policy as
`evaluation_timezone: "UTC"`.

The workbench initializes a visible **As of (UTC)** date from the current UTC
calendar date and sends that value explicitly on every initial load, refresh,
and host-driven reload. The user-visible value, rather than a hidden request
clock, is the evaluation authority.

A configurable organization or tenant time zone is deferred. Adding one would
require a separate product and architecture decision, an ownership and
authorization contract, and a data migration when a persisted setting is
introduced. This slice must not infer a time zone from browser locale,
organization text, shipment locations, or server configuration.

## 3. Warning Horizon

The reviewed warning horizon is exactly 30 calendar days and is inclusive.

For request date `as_of`:

```text
expiring_soon_through = as_of + 30 calendar days
```

The response echoes:

- `as_of`;
- `evaluation_timezone`;
- `expiring_soon_horizon_days: 30`; and
- `expiring_soon_through`.

The exact date classifications are:

| Classification | Rule |
|---|---|
| Expired | `expires_on < as_of` |
| Expiring soon | `as_of <= expires_on <= expiring_soon_through` |
| Beyond the warning horizon | `expires_on > expiring_soon_through` |

An expiry exactly on `as_of` is expiring soon, not expired. An expiry exactly
30 calendar days after `as_of` is also expiring soon.

## 4. Eligible Shipment Owner Facts

Only current document instances in `recorded` or `verified` status are eligible
for expiry evaluation.

| Document-instance state | Expiry treatment |
|---|---|
| `recorded` | Eligible |
| `verified` | Eligible |
| `rejected` | Not expiry-eligible; retains its existing independent attention rule |
| `draft` | Excluded |
| `superseded` | Excluded |

For eligible instances:

- `document_instance_expiry_evaluated` counts all current `recorded` and
  `verified` rows, including rows where `expires_on` is null;
- `document_instance_expiry_not_recorded` counts the eligible subset whose
  `expires_on` is null;
- `document_instance_expired` counts eligible non-null dates before `as_of`;
- `document_instance_expiring_soon` counts eligible non-null dates from
  `as_of` through `expiring_soon_through`, inclusive; and
- `next_document_expiry_on` is the earliest non-null eligible expiry date on
  or after `as_of`; expired dates are excluded, and the value is null when no
  current or future eligible expiry remains.

A null `expires_on` is informational. It emits an explanation but does not by
itself change a readiness band. UOK does not assume that every Document Type
legally requires an expiry date.

## 5. Shipment Public Facade Contract

The supported Shipment facade keeps the same two Intelligence-facing symbols:

- frozen `ShipmentReadinessSnapshotDTO`; and
- `resolve_shipment_readiness_snapshots`.

The resolver receives the exact `as_of` and inclusive
`expiring_soon_through` dates from Intelligence. It remains the sole owner of:

- `shipments.read` enforcement;
- `shipments.core` operational-state enforcement;
- `actor.organization_id` scoping;
- document-instance status and expiry-date interpretation at the owner row
  boundary; and
- denied, missing, and unavailable redaction.

The frozen owner DTO adds only the five aggregate value fields defined above.
It still exposes no requirement ID, document-instance ID, Compliance Document
Type ID, document number, issuer, note, file, binary, storage key, ORM object,
repository, query, table, or SQL expression.

`intelligence.core` must not import Shipment internals or read a Shipment table
directly. Shipment must not depend on Intelligence.

## 6. Deterministic Readiness Rules

The existing bands remain unchanged:

| Band | Exact rule |
|---|---|
| `attention_required` | `required_missing > 0`, `document_instance_rejected > 0`, `document_instance_expired > 0`, or `document_instance_expiring_soon > 0` |
| `not_assessed` | Otherwise, `required_total == 0` |
| `ready` | Otherwise |

The existing fixed reasons remain valid. This slice adds:

- `expired_document_present`;
- `expiring_document_present`; and
- `document_expiry_not_recorded`.

`expired_document_present` and `expiring_document_present` explain attention
conditions. `document_expiry_not_recorded` is informational and never changes a
band by itself.

The derivation is a pure function of the immutable owner DTO plus the explicit
evaluation metadata. Repeated reads with the same owner facts and `as_of` date
must return the same result.

Shipment lifecycle remains context only. Intelligence does not change a
Shipment header, requirement, document-instance state, version, or history,
and the advisory result does not block a movement transition.

## 7. HTTP Response

The existing endpoint remains:

```http
GET /api/intelligence/shipment-readiness?as_of=YYYY-MM-DD
```

The frozen list response adds the evaluation metadata. Each signal adds the
five owner aggregate values and may include the three new fixed reason codes.

The adapter:

- requires `intelligence.read`;
- verifies `intelligence.core` is operational;
- parses the required date;
- calculates the inclusive 30-calendar-day end date;
- calls the Shipment public facade once with both dates; and
- fails closed when Shipment denies or cannot supply the source facts.

It performs no write and provides no mutation endpoint.

## 8. Read-Only Workbench

The module-owned Shipment Readiness workbench adds:

- a visible **As of (UTC)** date input;
- the reviewed 30-day horizon and inclusive through-date;
- expired and expiring-soon counts;
- missing-expiry context;
- earliest eligible expiry date; and
- localized, non-color-only reason text.

The existing search, readiness-band filter, list/detail selection, Refresh,
safe owner-authorized Shipment link, keyboard behavior, responsive layout, and
read-only module-state handling remain.

The frontend calls only the Intelligence endpoint, always with the explicit
`as_of` query value. It imports no Shipment frontend code, invokes no
Shipment/Compliance endpoint, and exposes no create, edit, upload, status, or
workflow control.

## 9. Tenant, Authorization, And Data Boundary

- Intelligence reads require `intelligence.read`.
- Shipment independently requires `shipments.read`.
- Both module operational states are enforced.
- Every owner query remains scoped to `actor.organization_id`.
- Foreign-tenant Shipments never enter list mode.
- Denied, missing, and unavailable facts remain redacted.
- Date aggregates contain no organization ID or child-row identity.
- No direct dependency on Compliance, Contacts, Location, Route, Product,
  Planning, Reports, Calendar, Communications, or Agents is added.
- No foreign ORM, table, repository, schema, migration, raw SQL, join,
  reflection, metadata access, or foreign key is allowed.
- No file, binary, multipart, preview, download, or object-store path is
  introduced.

## 10. Architecture And ADR Disposition

No new ADR is required for this bounded fixed-UTC product policy.

The extension stays inside the already accepted ADR-0028 seam:

- the same Intelligence HTTP adapter;
- the same two-symbol Shipment facade dependency;
- immutable tenant-authorized owner DTO values;
- the same neutral frontend module-surface contract;
- no new Host or Kernel responsibility;
- no new module, table, mapping, command, event, extension point, dependency,
  or deployment unit; and
- no change to the modular-monolith extraction boundary.

A future configurable tenant time zone is not authorized by this design. That
work would require a separate decision and migration as applicable.

## 11. Verification Plan

### Shipment owner contract

- required `as_of` and inclusive through-date are passed to the owner;
- recorded and verified rows are eligible;
- draft and superseded rows are excluded;
- rejected rows retain their existing independent attention behavior;
- null expiry is counted as not recorded but not expired/expiring soon;
- exact lower and upper date boundaries are covered;
- leap-month/year date arithmetic uses calendar dates;
- earliest eligible current/future date excludes expired dates and becomes
  null when no current/future eligible expiry remains;
- tenant, permission, unavailable, missing, and explicit-ID redaction remain;
  and
- owner snapshots remain frozen aggregate values without Intelligence bands.

### Intelligence owner

- missing or invalid `as_of` is rejected;
- response evaluation metadata is exact and immutable;
- expired and expiring-soon conditions derive `attention_required`;
- a null expiry emits only `document_expiry_not_recorded`;
- existing missing, rejected, not-assessed, and ready behavior remains;
- repeated same-date reads are deterministic;
- Shipment header lifecycle and version remain unchanged; and
- source denial or unavailability still fails closed.

### Frontend

- every request includes the visible `as_of` value;
- UTC labeling and 30-day inclusive horizon are visible;
- changed dates trigger a fresh deterministic read;
- date validation, loading, empty, error, 401, 403, and disabled states remain
  safe;
- expired, expiring-soon, and missing-expiry details are localized and
  accessible;
- no mutation control or foreign API request exists; and
- desktop, 375-CSS-pixel, keyboard, RTL, and console-clean behavior pass.

### Candidate evidence

The exact-source verifier reuses the Shipment candidate's verified document
instance expiring on `2026-10-21`. It changes only the explicit `as_of` query
date to prove:

1. `2026-09-20`: outside the horizon because the inclusive through-date is
   `2026-10-20`;
2. `2026-09-21`: expiring soon on the inclusive 30th-day boundary;
3. `2026-10-21`: expiring soon on the same-day lower boundary; and
4. `2026-10-22`: expired on the next day.

It must prove exact response metadata, counts/reasons, unchanged document
metadata and lifecycle, unchanged Shipment header lifecycle/version, disabled
module failure, and no Intelligence mutation. Null expiry and ineligible
draft/superseded status semantics are required focused owner/domain tests; the
candidate verifier does not need to create separate live rows for them.

## 12. Rollback

Rollback is to disable `intelligence.core` or revert this slice. Because the
change owns no data and performs no write, there is no data rollback,
backfill, cache purge, or migration reversal.

After rollback, Shipment-owned expiry dates and histories remain unchanged and
available to their owner.

## 13. Non-Goals

- Configurable organization or tenant time zones.
- Per-Document-Type expiry requirements or legal-validity decisions.
- Workflow blocking, automatic requirement updates, status changes, or
  document-instance mutation.
- Notifications, schedules, background evaluation, persistence, cache, or
  historical signal snapshots.
- Scores, ranking, prediction, probability, confidence, anomaly detection,
  forecasting, optimization, recommendation, ML, or LLM inference.
- Document files/binaries, uploads, preview, download, storage keys, or object
  storage.
- Customs, carrier, tracking, route-risk, ETA, inventory, Planning, Contacts,
  or Reports behavior.
