# ADR-0033: Legacy Credential Retirement And Authentication Rate Limits

**Status:** Accepted

**Current candidate:** `UOK-3.1.0-alpha.3`

**Date:** 2026-07-25

## Context

UOK previously stored unsalted SHA-256 password hashes. The qualified local
database now contains zero 64-hex legacy credentials and five Argon2id
credentials. UOK has no published release or package that requires a weak
online compatibility verifier.

The in-process authentication limiter also needs a fixed memory bound without
letting identity churn evict an active block.

## Decision

- Argon2id is the only accepted credential format. New, reset, seeded, and
  verified credentials use Argon2id.
- UOK has no SHA-256 password-verification fallback or migration environment
  flag. A database with a legacy credential is rejected until an authorized
  password-reset or external-IAM process replaces it.
- Unknown users, malformed hashes, legacy hashes, and wrong passwords return
  the same generic response.
- The local limiter hashes identity keys and also limits the immediate ASGI
  client address. Expired keys are pruned, but an unexpired key is never
  evicted to admit a new one.
- Prune, capacity, block, and record operations share one thread-safe critical
  section. Successful login may clear only its identity bucket; it cannot
  reset accumulated immediate-client failures.
- Capacity saturation fails closed with HTTP 429.
- Production ingress must provide a trusted-edge or shared rate limiter. The
  in-memory layer is defense in depth for the committed single-worker runtime,
  not multi-worker or distributed enforcement.
- Promotion requires a credential-free legacy count, restore-tested backup,
  restart, and Argon2id login proof.

## Consequences

Weak offline-verifiable credentials cannot authenticate through UOK. An
unmanaged legacy database needs an operator-approved reset or IAM recovery
before upgrade. This is stricter than a temporary compatibility window and
removes a high-severity credential-hashing finding from the login boundary.

A saturated local limiter may temporarily reject a new legitimate identity,
which is preferable to evicting an active attacker block.

## Alternatives Considered

- Time-bound SHA-256 verification with immediate Argon2id replacement.
  Rejected because the qualified inventory is already zero and an unavoidable
  weak verifier would remain reachable during the window.
- Unconditional SHA-256 fallback. Rejected because it preserves a weak
  credential format without an operational boundary.
- Evict the oldest limiter key at capacity. Rejected because identity churn
  can remove a still-active block.
- Treat the local dictionary as production distributed enforcement. Rejected
  because process-local state cannot coordinate workers or hosts.

## Validation

`tests/test_auth_security.py` proves Argon2id-only verification, generic
legacy/wrong/unknown rejection, hashed bounded keys, fail-closed saturation,
and survival of an active block under churn. It also proves atomic capacity
under concurrent requests and that successful login cannot reset the
immediate-client anti-spray bucket.

The upgrade inventory and reset/IAM requirement are documented in
`docs/operations/UOK_STANDARD_OPERATIONS.md`.
