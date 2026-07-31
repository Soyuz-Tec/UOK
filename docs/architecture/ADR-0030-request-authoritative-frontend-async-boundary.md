# ADR-0030: Request-Authoritative Frontend Async Boundary

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
- The migration is intentionally incomplete after the foundation sub-slice.
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
- presentation-only rerenders that do not restart requests.

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
