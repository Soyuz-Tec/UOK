# ADR-0018: Planning Portfolio and Release-Readiness Boundary

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Gate E requires a useful multi-project view and repeatable production-like
evidence. Loading every project schedule independently would create an N+1
read path, disclose too much project detail, and make performance claims depend
on the number of visible projects. A local alpha check must also not be
misrepresented as production deployment or production readiness.

## Decision

Planning owns an actor-scoped portfolio read model under its existing API
boundary. The read model first pages projects inside the actor organization,
then computes task, dependency, gate, and blocking-link summaries for the
visible project IDs. It executes two queries for an empty page and at most six
queries for a populated page, independent of the number of visible projects.
The response reports its strategy, query count, and elapsed time; HTTP also
reports the aggregate duration through `Server-Timing` and forbids shared
caching.

Health is explainable, not predictive: blocked work, unresolved required gates,
or unavailable blocking links produce `blocked`; overdue work or project dates
produce `attention`; otherwise a project is `on_track`. The typed React
portfolio renders totals, non-color health labels, a shared date-range timeline,
filters, and an explicit drill-in to the existing authoritative project
schedule. Scheduling and mutation authority remain unchanged.

The `PlanningReleaseReadiness` operation composes existing candidate contracts,
PostgreSQL scale budgets, persistent CPM recovery, two-client concurrency
recovery, live Chromium compatibility/accessibility/console checks, and the
engineering scorecard. This is production-like local evidence only. Hosted CI,
review, merge, deployment controls, real monitoring, and all remaining
`production_ready` boundaries stay separate.

## Consequences

- Portfolio cost is bounded and directly testable without a new cache or table.
- Authorization is applied before project IDs enter aggregate queries.
- Portfolio status remains derived read-model data and cannot mutate schedules.
- Operators have one repeatable closure command instead of an undocumented
  sequence.
- Passing the command closes Gate E at `runtime_proven`; it does not claim a
  production deployment.

## Alternatives

- Loading each schedule from the browser was rejected because it creates N+1
  traffic and inconsistent snapshots.
- Persisting portfolio rollups was rejected because this slice does not need
  eventual consistency, cache invalidation, or a new migration.
- A cross-organization administrator view was rejected because no reviewed
  authority contract exists for it.
- Labeling the local alpha candidate `production_ready` was rejected because
  hosted and deployment controls remain outstanding.

## Validation

- actor isolation, viewer access, filtering, paging, health, and HTTP headers;
- exact six-query populated path and sub-500 ms focused integration budget;
- typed component filter, diagnostic, health, empty/error, and drill-in tests;
- responsive, RTL-safe, coarse-pointer, and Chromium workspace proof;
- candidate runtime portfolio readback;
- full `Verify`, rebuilt PostgreSQL candidate, and
  `PlanningReleaseReadiness` operation.
