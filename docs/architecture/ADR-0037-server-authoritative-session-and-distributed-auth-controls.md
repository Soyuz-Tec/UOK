# ADR-0037: Server-Authoritative Session and Distributed Authentication Controls

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Security owners

**Relations:** Would amend ADR-0034

## Context

UOK signs self-contained bearer tokens and rechecks that the user and exact
membership still exist. Role changes invalidate the old role claim, but there
is no session identifier, logout revocation, signing-key rotation protocol, or
distributed authentication rate limiter. The current bounded in-process
limiter is appropriate for one development process, not multiple replicas.

## Decision

Before multi-replica or external-IAM production use, introduce a
server-authoritative session record or standards-based identity provider. Bind
tokens to a session identifier, organization, issued-at time, expiry, and key
identifier; verify current session and membership state on every protected
request. Define logout, forced revocation, key rotation, refresh/replay
protection, and auditable administrator termination. Move client/identity rate
limits to a shared atomic store or trusted ingress control with privacy-safe
keys and explicit proxy trust.

## Consequences

Immediate revocation and consistent replica behavior become possible, at the
cost of an additional stateful dependency and migration/availability design.
The existing self-contained local mode may remain explicitly local-only.

## Alternatives

- Shorter stateless token TTLs reduce exposure but do not provide immediate
  revocation or shared rate limiting.
- Ingress-only limiting does not cover session authority or trusted-client
  identity by itself.
- External IAM is viable only with tenant mapping, logout, key rotation,
  outage, and claims-validation contracts.

## Validation

Require threat modeling plus multi-replica tests for revocation, concurrent
refresh, replay, key rollover, membership changes, proxy/client attribution,
store outage, and limiter atomicity. Production readiness must include audit
evidence and recovery behavior.

## Rollback

Keep the existing local-only signer behind an explicit environment profile.
Do not silently fall back to stateless authentication in a production profile
when the session authority or shared limiter is unavailable.

## Revisit triggers

Revisit when accepting this proposal, selecting an IAM provider, adding a
second API replica, or defining production logout and incident requirements.
