# ADR-0014: Planning Reproducible Risk Analysis

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Schedule-risk percentiles are not actionable evidence when the source state,
random seed, distributions, correlation assumptions, engine, or limits are
missing. Gate D requires repeated analysis of the same governed inputs to
produce the same result and forbids simulations from mutating approved work.

## Decision

Add the first-party `uok-monte-carlo-risk` engine version `1`. Every run must
reference one verified ADR-0013 snapshot and persist:

- snapshot ID and checksum;
- nonnegative 64-bit seed;
- 100 to 5,000 iterations;
- 1 to 200 unique task triangular distributions with minimum, most-likely,
  and maximum durations;
- optional named correlation groups with coefficients from 0 through 0.95;
- engine name/version, dependency-engine assumption, correlation method,
  executed limits, percentiles, target probability, and confidence method;
- independent result validation, checksum, creator, and audit correlation.

The engine reruns CPM for every sample on detached snapshot tasks. Correlated
tasks use a documented bounded uniform-rank blend between a shared group draw
and an individual draw. The combined iteration/task product is capped at
250,000. Results expose P50/P80/P90/P95 finish dates and durations plus the
probability of finishing on or before the snapshot target.

Analysis runs are append-only through ORM listeners and a PostgreSQL trigger.
They require `planning.analyze`; no run is an approved recommendation and no
run can mutate or apply schedule changes.

## Consequences

- Same snapshot checksum, seed, engine version, and normalized inputs produce
  exactly the same stored result in the current engine.
- Correlation behavior is explicit but intentionally simpler than a calibrated
  copula model; assumptions are visible in every result.
- Bounded iterations and sample/task product prevent unreviewed compute growth.
- Engine changes require a new version and reproducibility fixtures.

## Alternatives

- Unseeded browser simulation was rejected because it is not reproducible,
  authoritative, or auditable.
- Adding a scientific-computing dependency was rejected because the bounded
  first-party engine satisfies current requirements without expanding the
  approved stack.
- Persisting only percentile output was rejected because inputs and assumptions
  are necessary forensic evidence.

## Validation

- identical snapshot/seed/input exact reproduction and different-seed fixture;
- monotonic percentile and probability-range validation;
- distribution order, iteration, task, and product limits;
- persisted snapshot checksum, assumptions, limits, engine, and confidence;
- ORM/PostgreSQL append-only rejection, candidate proof, and typed UI.
