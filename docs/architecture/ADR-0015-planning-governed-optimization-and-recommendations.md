# ADR-0015: Planning Governed Optimization and Recommendations

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

An optimizer can produce technically feasible changes that are operationally
unsafe or based on invalid assumptions. Gate D requires bounded analysis,
independent hard-constraint checks, explainable ranked recommendations,
explicit approval before apply, audit evidence, and rollback. It also requires
dependency and complexity review before adding a solver.

## Decision

Use a first-party advisory engine, `uok-bounded-schedule-optimizer` version `1`,
without adding a solver dependency. The current objective is explicitly
`minimize_project_finish`. The engine:

- references one verified immutable what-if snapshot;
- evaluates at most 100 deterministic one-working-day compression candidates;
- enforces a 1 to 2,000 millisecond wall limit;
- reruns CPM, schedule validation, and independent CPM validation per candidate;
- returns `completed`, `timeout`, or `infeasible` explicitly;
- records engine/version, objective, limits, evaluated count, explanations,
  ranked impact, effort, side effects, assumptions, proposal, and preview;
- returns at most five independently validated improving recommendations.

This is bounded advisory search, not a global or optimal RCPSP solver. Duration
compression is an assumption that requires delivery-owner validation.

Recommendations implement one controlled lifecycle:

`proposed -> approved|rejected -> applied -> rolled_back`

Approval requires `planning.analysis.approve` and a reason. Apply and rollback
require `planning.edit`, a current strong ETag, and exact before/after task-date
matching so stale recommendations fail closed. Apply and rollback use normal
schedule propagation/validation and record the resulting aggregate revision.
Every stage emits command-correlated module and Planning events. PostgreSQL and
ORM state machines reject unsupported transitions.

## Dependency Review

No new package is introduced. The current representative chain benchmark does
not justify an external solver: 50 candidates across a 50-task chain complete
in approximately 0.25 seconds on the local candidate, inside the 2-second
engine limit. A future solver requires a new ADR covering measurable need,
license, supply chain, determinism, deployment size, timeout/cancellation, and
fallback behavior.

## Consequences

- Analysis cannot silently become schedule truth.
- Operators see why a recommendation exists, its modeled impact, and its
  operational assumptions before approval.
- Stale, rejected, infeasible, and timed-out work remain explicit evidence.
- Rollback is safe only while affected task dates still match the applied
  proposal; otherwise a new reviewed change is required.
- The bounded engine may miss globally feasible improvements and says so.

## Alternatives

- Adding OR-Tools or another solver was rejected because current measured need
  does not justify dependency and operating complexity.
- Automatically applying the top result was rejected because it bypasses
  owner feasibility, permission, stale-state, and audit controls.
- Treating timeout or no improvement as success was rejected because it hides
  material decision context.

## Validation

- representative chain, timeout, and infeasible fixtures;
- objective/limit/engine metadata and independent hard-constraint validation;
- ranked impact, effort, side-effect, and assumption evidence;
- unauthorized/early apply denial, reasoned approval, exact apply, audit chain,
  stale protection, rollback, and direct invalid-transition rejection;
- 50-task/50-candidate benchmark, rebuilt candidate, and full gates.
