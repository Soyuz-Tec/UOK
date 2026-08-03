# ADR-0035: Request-Authoritative Frontend Async Boundary

**Status:** Accepted

**Date:** 2026-07-30

**Current candidate:** `UOK-3.1.0-alpha.3`

**Amends:** `ADR-0028-host-composition-and-neutral-module-surface-contracts.md`

## Context

ADR-0028 established a narrow, one-way frontend host port and retained visited
module roots so owner-local drafts survive navigation. The original contract
did not expose whether each retained surface is active, represented token and
unauthorized handling as separate host fields, and provided no shared proof
that an asynchronous completion still belongs to the current session and owner
state.

A request can outlive a session replacement, same-token role or capability
change, module disable/re-enable, criteria or entity change, surface
deactivation/reactivation, or component lifetime. Equality checks are
insufficient because an `A -> B -> A` transition can make an old completion or
previously committed state appear current again. `AbortSignal` is cooperative
and cannot prove freshness when work has already completed or cannot be
cancelled. A transport helper that invokes an unauthorized callback before its
caller checks freshness can also let an old `401` clear a newer session.

The boundary must prevent every stale post-request side effect without moving
module criteria, DTOs, commands, or workflow state into the shell.

## Decision

1. The shell owns one atomic authentication-session state containing a
   monotonically increasing generation, token, and current user. Replacing or
   clearing a session advances the generation even when later values equal an
   earlier session. Token, user, derived role, and the module session projection
   come from the same committed snapshot.

2. The neutral module host port replaces its independent top-level token and
   unauthorized fields with:

   ```ts
   export type ModuleSurfaceSession = {
     token: string;
     generation: number;
     onUnauthorized: () => void;
   };
   ```

   `ModuleSurfaceHostContext` contains this atomic session projection plus the
   existing neutral role, appearance, module-status, lifecycle-action, refresh,
   refresh-revision, and busy-state capabilities. The unauthorized callback is
   bound to the projected session generation and cannot clear a replacement
   session.

3. The generated registry alone extends the base host context for each render:

   ```ts
   export type ModuleSurfaceRenderContext = ModuleSurfaceHostContext & {
     surfaceActive: boolean;
   };
   ```

   `surfaceActive` reports whether that exact retained surface is currently
   presented. Hidden visited roots remain mounted so owner-local drafts survive,
   but owners can invalidate active-only work and close transient behavior when
   the surface becomes inactive. Module entries and the shell do not invent or
   override this value.

4. `web/src/shared/request-authority` owns a product-neutral, framework- and
   transport-independent request-authority primitive. An owner creates its own
   `RequestAuthority`; no host-global authority coordinates module criteria or
   workflow state.

   - `createRequestAuthority()` returns an authority with a monotonic `epoch`.
   - `begin(lane)` issues the newest ticket in an owner-named lane and
     cooperatively aborts the previous ticket in that lane.
   - Separate lanes, such as list, detail, options, and mutation, remain
     independent.
   - `invalidate()` advances the epoch and invalidates every lane.
   - `dispose()` permanently invalidates the authority for owner unmount.
   - A ticket exposes its captured epoch, `AbortSignal`, `isCurrent()`,
     `runIfCurrent()`, `onceIfCurrent()`, and `release()`.

5. Owners advance their authority whenever a fact that authorizes or identifies
   their work changes: session generation, authorization-relevant role or
   capability, module operational or lifecycle state, request criteria,
   selected entity or version, active-only surface activation, or component
   lifetime. Appearance, locale, and other presentation-only rerenders do not
   invalidate unrelated work. `moduleRefreshRevision` remains a refresh
   instruction and is not request authority.

6. A request ticket is the commit proof. Every post-await effect verifies the
   same current ticket, including data, capability, selection, error, status,
   loading or `finally`, host refresh, and unauthorized dispatch. A
   request-bound unauthorized callback uses `onceIfCurrent()` so parallel or
   repeated response paths can clear only the session that authorized the
   request and can do so at most once. Shell-owned module lifecycle mutations
   are serialized in invocation order and reconcile host state after each
   possible server commit; they are not treated as latest-wins because aborting
   a request cannot retract an accepted mutation.

   Compliance command owners apply the same distinction. Dispatch authority is
   rechecked immediately before one command invocation, including the
   monotonic authority epoch so a boundary `A -> B -> A` transition fails
   closed. Once dispatched, a command is deliberately non-abortable, is not
   superseded, and is never automatically replayed. One caller-owned
   idempotency key identifies that operation. Its mutation-effect ticket guards
   only browser effects tied to the captured intent, including one-shot current
   unauthorized handling. A separate single-flight reconciliation obligation
   survives ticket invalidation, session or role changes, surface deactivation,
   and ambiguous response loss until the current readable owner boundary
   reconciles list, selected detail, and history. Command response records are
   selection hints only; reconciled server state owns the committed UI and
   status message.

7. Cooperative cancellation is an efficiency mechanism, not freshness proof.
   Non-abortable work and already-delivered responses still require a current
   ticket before any side effect.

8. Owner state that can survive an authority transition carries the captured
   request epoch, for example `authorityEpoch: ticket.epoch`. It is rendered or
   reused only while `authority.isCurrentEpoch(authorityEpoch)` is true. This
   masks previously committed `A` state during an `A -> B -> A` transition
   before the replacement request completes.

9. Adoption is phased and owner-local:

   - Delivery 6a establishes the atomic shell session, amended module surface
     contract, per-surface activity signal, shared request authority, and shell
     request adoption.
   - Delivery 6b adopts that contract for Compliance list, detail, and history
     reads, including same-token generation, activation, operational, role,
     unauthorized, and lifetime invalidation.
   - Delivery 6c adopts dispatch authority, guarded browser effects, and
     persistent server reconciliation for Compliance create, update,
     activate/deactivate, and archive/restore commands.
   - Delivery 6d adopts the contract for the Contacts primary party-list,
     contact-group-list, and selected-party-detail reads. The owner uses
     independent `list`, `groups`, and `detail` lanes; invalidates them across
     session generation, authorization-relevant role, module operational state,
     retained-surface activation, and component lifetime; captures the complete
     Contacts filter tuple with ABA-safe criteria generations for list reads;
     and captures selected Party ID plus the selected row revision for detail
     reads. At Delivery 6d acceptance, Contacts commands, saved views, activity,
     relationship-options lookup, Groups Manager workflows, and Data Tools all
     remained later owner-local slices; Delivery 6e below narrows the next
     command subset without changing the 6d read boundary.
   - Delivery 6e adopts a bounded Contacts command slice. It is
     limited to `CreateContact`, `UpdateContact` from the form, inline editor,
     or mark-ready action, `ArchiveContact`, and `RestoreContact`. These commands
     apply the established one-time non-abortable dispatch, guarded
     captured-intent browser effects, and a retained reconciliation obligation
     for the current primary party list, contact-group projection, selection,
     and selected-party detail. The selected row `updated_at` value proves only
     that browser intent still names the same observed row revision; it is not
     an ETag, an optimistic-concurrency precondition, or protection from a
     server-side lost update. At Delivery 6e acceptance, purge, notes and
     activity, selected-party group membership and Groups Manager, relationship
     commands and options, merge and dedupe, Data Tools, import/export, saved
     views, and other audited owner paths remained later authority-adoption
     slices; Delivery 6f below narrows activity and relationship productivity
     without changing the 6e primary-command boundary. A synchronous owner-local
     command gate nevertheless spans adopted and excluded commands so an
     excluded mutation and refresh cannot overlap an adopted reconciliation.
     Token or session-generation replacement clears tenant-owned Contacts
     drafts, notes, relationship targets, search, group, filters, and page
     state; retained-surface deactivation alone preserves that state.
    - Delivery 6f implements a bounded Contacts activity and
      relationship-productivity authority slice. Local qualification completed
      on 2026-08-03; exact-head hosted CI remains required before merge. Activity
      and relationship-options hooks retain independent
     owner-local authorities and criteria: selected Party, paging, and refresh
     intent for activity; normalized query and excluded Party for relationship
     options. Every success, error, loading finalizer, and unauthorized effect
     is current-ticket guarded and epoch-stamped state is hidden once stale.
     The authenticated read responses are private, non-cacheable, and vary by
     authorization. `AddContactNote`, `LinkContactRelationship`,
     `UpdateContactRelationship`, and `RemoveContactRelationship` use the shared
     command gate, one-time non-replayed dispatch, current-only composer/editor
     effects, and current-primary list/groups/detail reconciliation. Notes and
     relationships remain fields of the selected-party detail projection; the
     slice adds no redundant notes or relationships read. Selected-row
     `updated_at` remains browser-intent freshness evidence only, not an ETag,
     optimistic-concurrency precondition, or lost-update guarantee. Purge,
     selected-party group membership and Groups Manager, merge/dedupe/rollback,
     Data Tools for facts, consent, teams, custom fields, and external
     identities, import/file/bulk/export, saved views, the current-detail
     `403`/`404` list-reconciliation residual, and other audited module owners
     remain later slices.
   - Later Delivery 6 slices migrate module owners in bounded groups while
     preserving their DTOs, endpoints, criteria, selections, commands, and
     specialized workflows.
   - Delivery 6 is complete only when every audited stale-session path uses the
     authority contract and the frontend audit reconciles the original finding.
   - Shared HTTP transport, server-side token revocation, and canonical browser
     navigation remain separate later decisions.

No manifest field, runtime module loader, backend API, database schema, or
remote frontend loading boundary changes.

## Consequences

- Old successes, failures, loading finalizers, and `401` responses cannot
  overwrite or clear a newer session when an owner applies the contract.
- Retained module drafts remain mounted while active-only requests gain an
  explicit deactivation boundary.
- Owners retain domain state and request criteria; shared code owns only ticket
  issuance, invalidation, cancellation, and freshness checks.
- Module surface callers use `host.session.token`,
  `host.session.generation`, and `host.session.onUnauthorized`; renderers also
  receive `surfaceActive`.
- The migration remains intentionally incomplete after each adopted sub-slice.
  Unmigrated owner paths remain tracked as open audit scope rather than being
  described as protected.
- The additional generation and state stamps are process-local frontend
  authority. They do not replace server authorization, token validation, or
  later revocation work.

## Alternatives Considered

- **Compare token, criteria, or selected IDs after `await`.** Rejected because
  equal values can recur after an intervening authority change and revalidate
  stale work.
- **Use `AbortController` alone.** Rejected because cancellation is cooperative
  and cannot retract an already completed response.
- **Unmount every inactive module surface.** Rejected because ADR-0028
  deliberately preserves owner-local drafts across navigation.
- **Put one global request manager in the shell.** Rejected because capability,
  criteria, selection, and workflow ownership belong to each module.
- **Fold request authority into the future shared HTTP transport.** Rejected
  because async authority also governs non-transport work and Delivery 7 owns
  transport mechanics separately.
- **Treat `moduleRefreshRevision` as authority.** Rejected because it is a
  refresh instruction, not proof of session, capability, criteria, activation,
  or lifetime freshness.

## Rollback

There is no database or manifest migration. Roll back the shared primitive,
atomic session projection, surface activity field, shell adoption, and all
dependent owner migrations together. Do not restore top-level token or
unauthorized access while any owner expects generation-bound session authority.

## Validation

Required focused proof includes:

- newest-ticket behavior and independent lanes;
- `A -> B -> A` epoch invalidation;
- non-abortable stale completion suppression;
- current and stale one-shot unauthorized callbacks;
- epoch-stamped committed-state masking;
- atomic session replacement and clear behavior;
- old-session shell success, error, `finally`, and `401` suppression;
- serialized shell lifecycle mutations with post-commit reconciliation;
- retained surface active, inactive, reactivated, and unmounted transitions;
- same-token capability and module disable/re-enable transitions; and
- presentation-only rerenders that do not restart requests;
- pre-dispatch session-generation, role/capability, operational, activation,
  criteria, selection/version, and lifetime transitions;
- one signal-free command POST with one caller-owned idempotency key and no
  automatic replay;
- commit-then-`503`, transport failure, malformed success, and conflict
  reconciliation;
- stale/current `401`, signed-out-to-new-session reconciliation, selection
  `A -> B -> A`, monotonic versions, and cross-owner history isolation; and
- failed host refresh, pending reconciliation retry, and mid-reconciliation
  user-intent supersession while the true operation lock remains active;
- Contacts `list`, `groups`, and `detail` lane independence and out-of-order
  completion;
- full-filter criteria `A -> B -> A` and selected-Party ID/revision
  `A -> B -> A` invalidation;
- same-token generation, role, disable/re-enable, inactive/reactivated surface,
  and unmount transitions;
- stale/current one-shot `401`, stale success/error/loading-finalizer
  suppression, and epoch-stamped Contacts list/group/detail masking; and
- presentation-only rerenders that do not restart primary Contacts reads.
- pre-dispatch invalidation and guarded browser effects for the bounded
  `CreateContact`, `UpdateContact`, `ArchiveContact`, and `RestoreContact`
  slice, including form, inline-edit, and mark-ready update intent;
- exactly one non-abortable command dispatch with one caller-owned idempotency
  key, no automatic replay, and stale/current one-shot unauthorized handling;
- current-boundary primary list, groups, selection, and selected-detail
  reconciliation after success or an ambiguous possible server commit; and
- session, role, operational, activation, filter, selection, selected-row
  `updated_at`, and lifetime transitions without claiming ETag or lost-update
  protection; and
- bidirectional adopted/legacy same-tick exclusion, reconciliation-pending
  exclusion, session-owned transient-state reset, and response-hint
  minimization;
- independent Contacts activity and relationship-options owner authorities,
  including criteria ABA, stale/current one-shot `401`, activation, session,
  role, operational, and lifetime invalidation;
- current-only activity/lookup success, error, loading-finalizer, empty-state,
  option-selection, and retry effects with epoch-stamped stale-state masking;
- private no-store and authorization-varying response headers for the adopted
  authenticated activity and relationship-options reads;
- shared-gate exclusion, one-time non-replayed dispatch, current-only
  note-composer and relationship-editor effects, and current-primary
  reconciliation for the four adopted productivity commands; and
- no redundant notes/relationships read and no ETag, optimistic-concurrency,
  or lost-update claim from selected-row `updated_at`.

Run:

```powershell
python scripts/quality_audit.py
python -m pytest tests/test_naming_policy.py tests/test_frontend_quality_policy.py -q
npm --prefix web run check:contracts
npm --prefix web run check:dependencies
npm --prefix web run lint
npm --prefix web test
npm --prefix web run test:accessibility
npm --prefix web run build:static
npm --prefix web run check:bundle-budget
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action TechnologyAudit
```
