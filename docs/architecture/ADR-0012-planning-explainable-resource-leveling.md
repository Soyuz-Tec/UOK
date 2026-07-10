# ADR-0012: Planning Explainable Resource Leveling

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning's original simple forward heuristic moved eligible tasks but used a
silent 260-step loop and returned only the resulting schedule. An unlevelable
schedule could therefore look successful even when overloads remained. Gate C
requires an explicit, independently checked, actionable result without
mislabeling a heuristic as optimization.

## Decision

Keep the deterministic first-party strategy and name it `simple_forward`.
Every `LevelPlanningResources` command accepts a bounded, user-visible horizon
from 1 through 1095 working days and returns:

- engine and strategy versions;
- `leveled`, `partially_leveled`, or `infeasible` outcome;
- configured horizon and executed pass count;
- initial overload count and exact changed task IDs;
- every remaining resource/date/task overload;
- stable reason codes with task, resource, and date context;
- an independent post-level validation result.

The strategy may move only assigned, auto-scheduled, non-summary,
non-milestone tasks. It respects project working dates, resource capacity
calendars, task/dependency/constraint propagation, and the project finish
limit. Manual dates remain immovable. The approved baseline is never updated.

After mutation, a separate validator recomputes resource loads and schedule
constraints, compares actual changed tasks and remaining overloads with the
reported values, and derives the expected outcome independently. Any mismatch
rolls back the command. The complete report is returned and audit-correlated.

This workflow is deterministic leveling, not optimization. A solver remains a
Gate D option that requires its own ADR and dependency review.

## Consequences

- No overload can be silently hidden behind a successful HTTP response.
- Partial and infeasible outcomes remain valid audited command results, with
  specific repair context rather than a generic server failure.
- A short horizon can intentionally limit search cost and produce an
  explainable `horizon_exhausted` reason.
- The current strategy may leave feasible global arrangements unresolved; it
  makes that limitation visible instead of claiming optimality.

## Alternatives

- Keeping a fixed internal loop was rejected because its limit was invisible
  and not reviewable by the operator.
- Treating any remaining overload as an HTTP failure was rejected because the
  attempted, audited partial result and diagnostics are operational evidence.
- Adding an optimizer in Gate C was rejected because dependency, licensing,
  reproducibility, approval, and rollback governance belong to Gate D.

## Validation

- feasible, partial, and infeasible integration fixtures;
- manual-task, allocation-capacity, horizon, and project-finish reasons;
- invalid-horizon rejection and stable typed UI submission;
- injected hidden-overload report rejected by the independent validator;
- approved baseline checksum remains unchanged;
- rebuilt candidate, full local gates, and audit correlation.
