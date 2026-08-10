# ADR-0043: External Integration Adapter and Webhook Boundary

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Integration and security owners

**Relations:** Depends on ADR-0037, ADR-0039, and ADR-0042

## Context

Contacts and Calendar describe provider-neutral identities and future adapter
needs, but UOK has no live-provider credential store, tenant-consent contract,
webhook verification/replay policy, rate-limit handling, deletion semantics,
or reconciliation operations. A provider-neutral data model is not evidence of
a functioning integration.

## Decision

Every live provider uses a module-owned adapter behind a product-neutral host
contract. The adapter declares credential ownership and rotation, tenant/admin
consent, scopes, data mapping, provider identifiers, cursor semantics,
idempotency, conflict authority, deletion propagation, rate-limit/backoff,
webhook signature and replay-window verification, event delivery dependency,
reconciliation, privacy classification, and disable/disconnect behavior. UI
states distinguish supported, configured, healthy, degraded, and disconnected.

## Consequences

Provider differences remain explicit and testable instead of leaking through
the kernel. Each adapter requires sandbox qualification, secret operations,
support ownership, and ongoing compatibility maintenance.

## Alternatives

- Provider SDK calls directly from product workflows were rejected because
  credentials, retries, consent, and failure semantics would be duplicated.
- A generic adapter that hides all provider differences was rejected because
  deletion, conflict, cursor, and webhook contracts are provider-specific.
- Polling-only integration may be chosen per provider, but it still requires
  cursor, rate-limit, reconciliation, and disconnect semantics.

## Validation

Require provider sandbox contract tests, secret rotation, scope reduction,
expired consent, webhook forgery/replay, duplicate/out-of-order events,
rate-limit and outage injection, cursor loss, deletion conflicts, reconciliation
after downtime, tenant isolation, observability, and disconnect/erasure proof.

## Rollback

Disable the adapter and revoke provider credentials while retaining enough
non-secret reconciliation evidence to resume or disconnect safely. Rollback
must not silently delete provider-owned data or continue accepting webhooks for
a disconnected tenant.

## Revisit triggers

Revisit when accepting this proposal, selecting the first provider, changing
provider scopes or deletion terms, or adding bidirectional synchronization.
