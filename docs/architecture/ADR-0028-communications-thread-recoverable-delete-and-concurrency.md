# ADR-0028: Communications Thread Recoverable Delete and Concurrency

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Approved:** 2026-07-15

## Context

K Connect threads are user-created records, but the initial provider slice had
no safe user-facing Delete or Restore path. Hard deletion would break audit
history and Planning typed links. A blind archive action would also be unsafe:
an actor can act on an outdated thread while another request changes it, and a
generic restore cannot know whether the thread was open or closed before it was
removed from active use.

## Decision

Implement recoverable deletion inside `communications.core`.

- User-facing **Delete** executes `ArchiveCommunicationThread`; it never removes
  the row, its audit evidence, or another module's link.
- `archived_from_status` stores the exact displaced `open` or `closed` state.
  `RestoreCommunicationThread` returns the thread to that state and clears the
  archive metadata. New lifecycle check constraints reject ambiguous states.
- `revision` is a positive, monotonically increasing per-thread validator.
  Exact thread reads and successful lifecycle responses expose the strong ETag
  `"communication-thread:<id>:v<revision>"`.
- Delete and Restore require the exact current ETag in `If-Match`. Missing,
  malformed, and stale validators return structured `428`, `400`, and `412`
  recovery contracts respectively, including current revision, current ETag,
  exact reload URL, and repair guidance.
- Mutation handlers load the exact organization-scoped row with
  `SELECT ... FOR UPDATE` and `populate_existing` before checking `If-Match`.
  This serializes validation and mutation and prevents an identity-map value or
  concurrent transaction from creating a check-then-write race.
- The browser commits a successful returned row locally before any later
  refresh. On a stale response it reloads only that exact thread, closes the old
  confirmation, shows the repair, focuses the newly valid action, and never
  retries automatically. The actor must explicitly open and confirm again.
- The server projects `read`, `create`, `delete`, and `restore` capabilities.
  Operations and traders can mutate, viewers remain review-only, and finance is
  denied. UI visibility is convenience; command authorization remains final.
- Active reads hide archived threads by default. Explicit `archived` and `all`
  lifecycle reads provide stable discovery even when there are no archived
  rows. Archived exact reads require `include_archived=true`.
- Planning continues to store the same typed thread identity. While archived,
  its resolver reports `unavailable` with no open path; Restore makes the same
  link ready again. There is no cross-module cascade.

Migration `002_communications_thread_recoverable_delete.sql` is additive. A
legacy archived row has no trustworthy prior-state fact, so the migration uses
`open` as its explicit compatibility state; all lifecycle actions performed
after this decision preserve the exact prior state.

## Consequences

- Users can remove their threads from active work without destructive data
  loss, and authorized users can reverse the action predictably.
- Lifecycle responses and exact reloads share one validator contract, allowing
  stale UI state to fail closed without silent last-write-wins behavior.
- Every successful transition emits one correlated archived or restored event;
  valid same-state replays are no-ops and do not duplicate evidence.
- Retained rows continue to consume storage and therefore remain subject to a
  later explicit retention/purge policy. This decision does not authorize
  purge, message deletion, close/reopen, or retention automation.

## Alternatives

- Hard deletion was rejected because it destroys auditability and leaves typed
  Planning references permanently missing.
- A boolean archive flag was rejected because it loses the prior open/closed
  state and makes Restore guess.
- Timestamp-only or weak client validation was rejected because it does not
  provide an exact, entity-bound optimistic-concurrency contract.
- Automatic retry after a stale response was rejected because it would apply a
  destructive intent to state the actor has not reviewed.
- A Planning-owned cascade was rejected because Communications owns thread
  lifecycle and Planning owns only its typed reference.

## Rollback

Roll back application behavior first while retaining the additive columns.
Before a schema rollback, back up the database, restore or otherwise disposition
every archived row, verify no row depends on `archived_from_status`, and verify
no supported client requires thread ETags. Only then remove the two new check
constraints and the `archived_from_status` and `revision` columns. Never drop
retained threads or Planning links as part of rollback.

## Validation

- migration and model constraint tests for prior state and positive revision;
- role/capability, module-state, missing/malformed/stale precondition tests;
- open and closed Delete/Restore tests with success ETag-to-reload equality;
- event uniqueness and retained identity/context/creator evidence;
- Planning link identity and unavailable/ready archive/restore integration;
- browser tests for retained-impact confirmation, cancel and transition focus,
  stable Archived discovery, review-only behavior, and explicit stale repair;
- generated OpenAPI/client contract checks and focused frontend/backend builds.
