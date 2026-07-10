# ADR-0010: Planning Resource Capacity Calendars

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

A typed resource still cannot guide scheduling if every day is implicitly 100
percent available. Part-time people, equipment service days, site closures,
and temporary coverage changes require resource-specific capacity facts.
Planning must also keep its project working calendar authoritative and must not
let `calendar.core` events silently move approved task dates.

## Decision

Add one Planning-owned capacity calendar per project resource. It stores:

- controlled ISO working weekdays;
- explicit holiday calendar dates;
- default daily capacity from 0 through 300 percent;
- at most 100 ordered, non-overlapping capacity exceptions with start, end,
  capacity percent, and a bounded reason.

Resource capacity for a project-working date is derived in this order:

1. outside the resource effective period is 0 percent;
2. a resource non-working weekday or holiday is 0 percent;
3. a matching capacity exception supplies the capacity;
4. otherwise the resource calendar default applies;
5. a resource without a calendar remains 100 percent for compatibility.

Project non-working dates continue to create no scheduled load. Resource dates
use the project timezone and calendar-date precision accepted in ADR-0005; no
time-of-day shift semantics are implied.

`SetPlanningResourceCalendar` is a guarded, idempotent, revisioned, audited
project mutation. Calendar facts are embedded under their resource in the
actor-visible schedule and immutable baseline. Resource-capacity engine v2 and
its independent validator both derive effective daily capacity. Workload UI
uses the validated load points instead of a fixed 100-percent threshold.

Simple leveling may move auto-scheduled tasks only when every assigned resource
has sufficient capacity on every resulting project-working date. Explicit
`leveled`, `partially_leveled`, and `infeasible` outcomes and horizon reasons
remain ACC-RES-003.

## Consequences

- Part-time, holiday, equipment-window, and temporary-capacity overloads are
  visible and independently checked.
- Baselines preserve the exact capacity assumptions used for later comparison.
- Calendar updates can change a strong schedule ETag and increment the project
  revision without changing a task date.
- JSON storage is limited to validated weekday/holiday/exception collections;
  identity, scope, uniqueness, and default-capacity bounds remain relational.

## Alternatives

- Reusing the project calendar was rejected because resource availability is
  not identical to schedule working time.
- Treating organization-wide `calendar.core` events as resource calendars was
  rejected because they lack resource correlation and user approval to move
  Planning tasks.
- Storing arbitrary availability JSON on the resource was rejected because it
  would bypass request bounds, non-overlap checks, audit evidence, and one
  stable command contract.

## Validation

- part-time human, holiday, temporary capacity, and effective-period fixtures;
- overlapping, over-limit, stale, permission, and database constraint rejects;
- resource-calendar-aware load points and independent validation;
- simple leveling avoids zero-capacity resource dates;
- immutable baseline calendar capture and generated API parity;
- typed UI/API tests, PostgreSQL readback, rebuilt candidate, and full gates.
