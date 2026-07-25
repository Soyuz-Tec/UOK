# ADR-0033: Bounded Legacy Credential Migration And Authentication Rate Limits

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Date:** 2026-07-24

## Context

UOK stores new credentials with Argon2id, but persisted databases may still
contain historical unsalted SHA-256 hashes. Rejecting every historical hash
without an upgrade path locks those users out. Accepting them indefinitely
retains a weak credential format. The in-process authentication limiter also
needs a fixed memory bound without letting identity churn evict an active
block.

## Decision

- Argon2id is the only normal credential format. Legacy SHA-256 verification
  is disabled by default and new writes never create that format.
- An operator may enable migration only with
  `UOK_LEGACY_SHA256_LOGIN_MIGRATION=1` and a required UTC
  `UOK_LEGACY_SHA256_LOGIN_UNTIL`. Application construction rejects malformed,
  expired, or longer-than-14-day windows.
- During an active window, only a strict 64-hex stored hash is eligible for a
  constant-time comparison. A successful match is committed as Argon2id
  before token issuance. The frozen deadline is checked on every login so a
  running process cannot outlive the window.
- Disabled, expired, wrong-password, malformed-hash, and unknown-user attempts
  return the same generic response.
- The local limiter hashes identity keys and also limits the immediate ASGI
  client address. Expired keys are pruned, but an unexpired key is never
  evicted to admit a new one. Prune, capacity, block, and record operations
  are one thread-safe critical section. Successful login may clear only its
  identity bucket; it cannot reset accumulated immediate-client failures.
  Capacity saturation fails closed with HTTP 429.
- Production ingress must provide a trusted-edge or shared rate limiter.
  The in-memory layer is a defense-in-depth control for the committed
  single-worker runtime, not a multi-worker or distributed enforcement point.
- Upgrade promotion requires a credential-free count by organization, a
  restore-tested backup when migration is needed, zero remaining legacy
  hashes, migration variables removed, restart, and Argon2 login proof.

## Consequences

Persisted upgrades have a bounded compatibility path without weakening the
default configuration. Active users migrate transparently; inactive users
still require an approved password-reset or external-IAM path before the
deadline. A saturated local limiter may temporarily reject a new legitimate
identity, which is preferable to evicting an active attacker block.

## Alternatives Considered

- Remove all compatibility immediately. Rejected because supported persisted
  accounts could be locked out without a reset surface.
- Restore unconditional SHA-256 fallback. Rejected because weak verification
  would have no operational deadline.
- Evict the oldest limiter key at capacity. Rejected because identity churn
  can remove a still-active block.
- Treat the local dictionary as production distributed enforcement. Rejected
  because process-local state cannot coordinate workers or hosts.

## Validation

`tests/test_auth_security.py` proves default rejection, strict bounded
configuration, expiry in a running process, generic failure responses,
successful one-time Argon2id rehash before token issuance, hashed bounded
keys, fail-closed saturation, and survival of an active block under churn.
It also proves atomic capacity under concurrent requests and that interleaved
successful login cannot reset the immediate-client anti-spray bucket.
The upgrade runbook and credential-free inventory query are in
`docs/operations/UOK_STANDARD_OPERATIONS.md`.
