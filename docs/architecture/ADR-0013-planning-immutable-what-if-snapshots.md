# ADR-0013: Planning Immutable What-If Snapshots

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Gate D analysis must not experiment on the approved schedule. Optimization and
risk outputs are not reproducible or governable unless they reference a
complete, immutable source state and preserve the exact temporary assumptions
used to produce a preview.

## Decision

Add a Planning-owned, append-only what-if snapshot artifact. Each snapshot:

- records the complete actor-visible approved schedule at one source revision;
- stores 1 to 100 typed temporary task date/progress changes;
- evaluates those changes on detached task copies only;
- stores preview task dates, CPM results, resource capacity, and validation;
- records creator and authoritative command correlation;
- uses canonical JSON and a SHA-256 checksum;
- is protected against update/delete by both ORM listeners and a PostgreSQL
  trigger.

Snapshot creation requires the distinct `planning.analyze` capability, a
current strong ETag, and a stable idempotency key. It increments the aggregate
revision because a new governed analysis artifact exists, but it never changes
approved task fields or task versions. Read access remains actor-scoped through
`planning.read`.

`planning.analysis.approve` is declared separately for the later Gate D
recommendation approval workflow. Snapshot creation does not imply approval
and no preview can apply itself.

## Consequences

- Temporary analysis changes cannot leak into schedule truth.
- Risk and optimization runs can reference one verified source checksum.
- Invalid or constrained previews may be retained as evidence rather than
  silently discarded.
- Snapshot payload size grows with the complete schedule; Gate E must measure
  and bound large-project capture and read performance.

## Alternatives

- Reusing approved baselines was rejected because baselines represent accepted
  control states, not temporary assumptions.
- Holding scenarios only in browser memory was rejected because it loses
  audit, reproducibility, permission, and recovery evidence.
- Mutating then rolling back live ORM rows was rejected because detached pure
  evaluation makes the non-mutation boundary explicit and testable.

## Validation

- approved and preview task values differ while live task values/versions do
  not change;
- checksum verification, idempotent replay, actor scoping, and capability
  denial;
- ORM and PostgreSQL update/delete rejection;
- additive migration readback and candidate lifecycle proof;
- typed Analysis inspector and generated API contracts.
