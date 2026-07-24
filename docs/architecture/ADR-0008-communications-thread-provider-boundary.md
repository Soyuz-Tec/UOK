# ADR-0008: Communications Thread Provider Boundary

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-10

## Context

Planning Gate B requires an operation or task to open the exact related K
Connect thread. A UI-only label or an unverified URL would falsely imply that a
communications provider exists. The integration must also survive module
disablement and must not disclose thread identity to an unauthorized actor.

## Decision

Introduce `communications.core` as the optional provider for K Connect thread
identity and access.

- `communications.core` owns thread identity, organization scope, title,
  context, lifecycle status, authorization, audit event, and retention.
- `CreateCommunicationThread` is an idempotent command guarded by
  `communications.edit`; reads are guarded by `communications.read` and module
  operational state.
- Operations and traders receive read/edit grants, viewers receive read-only
  access, and finance receives no communications grant.
- Planning stores only a `communication_thread` typed link. It has no foreign
  key to the provider and does not copy the provider payload.
- The Planning resolver performs an actor-specific provider lookup. Authorized
  active or closed threads resolve `ready`; archived or disabled-provider
  threads resolve `unavailable`; unauthorized reads resolve `denied` without
  identity or label; absent threads resolve `missing`.
- A ready link opens `/?view=communications&thread_id=<thread-id>`. The shell
  selects the K Connect workspace from the URL and the workspace selects the
  exact authorized thread.
- This slice provides real thread records and navigation. Message exchange,
  membership management, close/reopen commands, retention automation, and
  notification delivery remain later `communications.core` work. Recoverable
  thread Delete/Restore and its concurrency contract are governed separately
  by ADR-0029.

ADR-0022 closed the accepted alpha ORM bridge. The canonical SQLAlchemy mapping
now lives in `modules/communications.core/backend/uok_communications_core`.
ADR-0028 retired the former root compatibility alias; module behavior,
manifest, migration, API, commands, policy, tests, mapping, and candidate
verification remain owned by `communications.core`.

ADR-0029 extends this boundary without transferring ownership: Communications
retains archived rows and prior lifecycle state, while Planning keeps the same
typed reference and never cascades a thread lifecycle change.

## Consequences

- Planning can satisfy the communication-thread jump without simulating K
  Connect data or coupling module schemas.
- Provider disablement and permission denial are visible, safe resolver states
  rather than broken navigation or leaked thread information.
- URL-derived workbench selection becomes a shared shell behavior and also
  repairs direct links to other registered workspaces.
- The initial thread surface is deliberately narrow and must not be described
  as a complete messaging product.

## Alternatives

- A Planning-owned thread table was rejected because communications identity,
  authorization, lifecycle, and retention do not belong to Planning.
- A free-form external URL was rejected because it cannot prove target
  existence, authorization, module state, or safe lifecycle behavior.
- A visual K Connect placeholder was rejected because the acceptance package
  explicitly requires a working adapter and safe denied/unavailable behavior.

## Validation

- additive PostgreSQL migration apply and catalog readback;
- command idempotency, audit, role denial, and module lifecycle tests;
- Planning ready, denied, missing, and disabled-provider resolver tests;
- exact-thread typed-link candidate scenario;
- Chromium proof that a ready Planning link opens the exact K Connect thread;
- full UOK candidate and engineering verification gates.
