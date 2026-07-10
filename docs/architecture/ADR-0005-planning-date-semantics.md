# ADR-0005: Planning Execution Date and Timezone Semantics

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning previously used one task `start_at`/`end_at` pair for the approved
schedule. Operation control also needs forecast, observed actual, and deadline
facts without allowing the scheduler to overwrite execution truth. The Gantt
offers hour and minute visual scales even though authoritative scheduling is
calendar-date based. Project timezone and DST behavior were not explicit.

## Decision

- Existing `start_at` and `end_at` remain scheduler-owned planned dates and the
  compatible `start`/`end` API aliases.
- Add nullable forecast start/end, actual start/end, and deadline columns.
  Dependency propagation, constraints, summary rollup, and resource leveling
  may move planned dates only.
- A project receives one validated IANA timezone when it is created. Existing
  projects backfill to `UTC`; this slice does not expose timezone mutation.
- Execution-date inputs are ISO calendar dates. The server interprets them at
  midnight in the project timezone, stores the resulting instant in UTC, and
  serializes the project-local calendar date. This preserves dates across DST
  offsets without claiming time-of-day scheduling.
- Forecast and deadline facts require `planning.edit`. Actual facts use the
  same capability but every change or correction requires a non-empty audit
  reason. Actual finish requires an actual start and cannot precede it.
- The read model returns explicit planned, forecast, actual, and deadline
  labels plus start/finish variance in calendar days. Positive deadline
  variance means the planned finish is later than the deadline.
- The dedicated date mutation retains idempotency, strong `If-Match`, project
  locking, project revision, task version, command correlation, module event,
  and schedule event behavior.
- Complete baselines capture the date facts, calculated variances, project
  timezone, and stable date-semantics contract. The additive fields remain
  compatible with complete v2 snapshots; no schema version is redefined.
- Hour and minute timeline scales are explicitly visual-only. Mutations remain
  whole project calendar dates.

## Consequences

- Execution truth is queryable and auditable without contaminating schedule
  calculation inputs.
- UTC storage offsets differ across DST boundaries by design; project-local
  dates remain stable.
- Changing an established project timezone requires a future migration and
  explicit conversion policy.
- Time-of-day, shift, and subday dependency scheduling remain out of scope.

## Alternatives

- Reusing planned dates for execution was rejected because it destroys the
  approved schedule and makes variance unknowable.
- Browser-local dates were rejected because different users would observe
  inconsistent days.
- Authoritative subday scheduling was rejected because the current scheduler,
  constraints, CPM, calendars, and Gantt mutations are day based.
- Storing date facts only in task JSON was rejected because database
  invariants, indexing, typed APIs, and reliable reporting are required.

## Validation

- additive PostgreSQL 18 migration apply and schema readback after backup;
- New York spring/fall DST UTC-offset fixtures;
- forecast/actual/deadline order, reason, permission, ETag, and no-mutation
  rejection tests;
- planned reschedule proof that actual and deadline facts do not move;
- typed client and task-inspector tests;
- complete baseline capture, full Planning suite, rebuilt candidate, and live
  module verifier scenario.
