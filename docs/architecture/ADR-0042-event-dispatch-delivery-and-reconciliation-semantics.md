# ADR-0042: Event Dispatch, Delivery, and Reconciliation Semantics

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Integration and runtime owners

**Relations:** Extends ADR-0019

## Context

ADR-0019 stores one immutable Planning outbox envelope in the same transaction
as a schedule revision. It intentionally has no dispatcher, published state,
retry count, broker, consumer contract, or external-delivery claim. Other UOK
event and command logs are audit evidence, not a centralized event-driven core.

## Decision

Before any event crosses its owning transaction boundary, define a
product-neutral event envelope, schema compatibility rules, ownership,
organization scope, idempotency key, and privacy classification. Dispatch uses
leased claims with bounded exponential retry and at-least-once delivery;
consumers must be idempotent. Poison events enter an operator-visible dead
letter state without blocking unrelated aggregates. Delivery state remains
separate from immutable domain evidence, and reconciliation detects committed
events whose delivery state is missing or stalled.

## Consequences

External workflows gain durable, explainable delivery semantics, at the cost of
workers, operational state, schema governance, duplicate handling, and lag
monitoring. At-least-once delivery means consumers cannot assume uniqueness.

## Alternatives

- In-process fire-and-forget callbacks were rejected because process failure
  loses work.
- Exactly-once delivery was rejected as a general claim because end-to-end
  uniqueness depends on consumer side effects; idempotent at-least-once is
  testable.
- Treating audit logs as a broker was rejected because their schema and
  retention serve a different purpose.

## Validation

Require transactional creation tests, competing-dispatcher lease tests,
crash-after-publish and crash-before-ack injection, duplicate/out-of-order
consumer tests, schema compatibility checks, tenant isolation, dead-letter
operations, reconciliation proof, and observable delivery-lag SLOs.

## Rollback

Dispatch can be paused without deleting immutable envelopes or delivery state.
Consumers must tolerate replay from a reviewed checkpoint. Disabling a
consumer may not mark pending work delivered or discard dead letters.

## Revisit triggers

Revisit when accepting this proposal, selecting a broker or queue, publishing
the first external event, or changing delivery guarantees.
