# ADR-0019: Planning Revision Ledger and Transactional Outbox

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning already used a project revision, task versions, command logs, module
events, and schedule events. Those records proved correlated writes, but they
did not provide one immutable, queryable record for every committed project
revision. Searching JSON event payloads for an inverse command also allowed an
ambiguous substring query before application-level filtering. Gate A requires
exact revision history and an event/outbox record committed atomically with
the schedule without claiming an external delivery system that does not exist.

## Decision

Add two Planning-owned append-only tables under the existing project command
transaction.

- `planning_schedule_revisions` records organization, project, current and
  previous revisions, the exact command correlation, command type, optional
  inverse-source command, actor, all task versions, changed task IDs, a
  canonical checksum, and creation time.
- `planning_outbox_events` records exactly one schema-v1
  `PlanningScheduleRevisionCommitted` envelope for that ledger row. Its
  canonical payload and checksum are internal; public history returns only
  sanitized metadata, identifiers, and checksums.
- Project creation records revision `1` after previous revision `0`. Every
  later successful guarded command records the revision produced by the same
  transaction. Failure rolls back schedule, ledger, and outbox together, while
  idempotent replay creates nothing new.
- Existing databases receive no synthetic history. Their first post-migration
  mutation becomes the first recorded row and keeps its real previous/current
  revision numbers.
- Supported inverse batches resolve `source_command_id` by an exact
  organization/project/correlation ledger lookup. Event-payload substring
  search is not authoritative.
- PostgreSQL and ORM guards reject update/delete. PostgreSQL additionally
  checks same-organization command references, contiguous recorded history
  after the first row, matching outbox envelopes, and controlled JSON shapes.

The outbox has no delivery status, retry count, broker offset, dispatcher, or
published timestamp. It is durable commit evidence and a future integration
boundary, not proof of external delivery.

## Consequences

- One command-log ID now joins response, module event, schedule event, revision
  ledger, and outbox evidence without parsing unrelated payloads.
- History reads are actor-scoped and do not expose raw outbox payloads or actor
  identity.
- The extra inserts and task-version capture occur inside the project lock and
  must remain covered by scale and concurrency evidence.
- A future dispatcher can consume this boundary only through a separate ADR,
  delivery-state model, operations design, and runtime proof.

## Alternatives

- Reusing schedule-event JSON as the ledger was rejected because it lacks a
  unique project revision contract and requires payload search.
- A synthetic backfill was rejected because prior event streams cannot prove a
  complete one-row-per-revision history.
- Adding delivery columns without a worker was rejected because dormant state
  would imply reliability behavior that does not exist.
- Publishing directly inside the schedule transaction was rejected because an
  external broker failure would couple schedule availability to integration
  availability.

## Validation

- creation, task mutation, derived task-version, correlation, checksum, and
  sanitized history API tests;
- failed-after-insert rollback and idempotent replay tests;
- exact same-project source lookup plus payload-poisoning regression;
- ORM and PostgreSQL update/delete, sequence, tenant, and envelope guards;
- persistent concurrency verifier readback and candidate lifecycle proof;
- full Planning tests, generated OpenAPI parity, source policy, and local build.
