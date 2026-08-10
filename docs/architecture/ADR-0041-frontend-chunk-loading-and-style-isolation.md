# ADR-0041: Frontend Chunk Loading and Style Isolation

**Status:** Proposed

**Implementation status:** Planned

**Date:** 2026-08-09

**Owners:** Frontend platform owners

**Relations:** Would amend ADR-0023 and ADR-0036

## Context

The generated module catalog currently emits compile-time eager imports into
one Vite bundle. Per-surface React error boundaries contain render failures
only after code has loaded; they do not isolate a module import/bootstrap
failure or shared global CSS. Independent module deployment is not required,
but bundle growth and load failure need truthful boundaries.

## Decision

Retain the manifest-generated, compile-time-validated catalog while generating
one lazy-load boundary per module surface. Keep shared shell contracts in a
versioned base chunk and enforce module-local style entry points with scoped
class namespaces and lint checks. A chunk failure must identify the affected
module, preserve the shell and already-loaded siblings, expose an explicit
retry/reload action, and emit scrubbed diagnostics. This decision does not
authorize independent remote deployment or runtime-fetched manifests.

## Consequences

Initial load and import-failure containment improve, while navigation can incur
a first-load delay and chunk caching/version skew must be handled. CSS
namespacing reduces accidental leaks but is not a security sandbox.

## Alternatives

- Module federation or remote micro-frontends were rejected because UOK lacks
  independent deployment, compatibility negotiation, trust, and rollback
  requirements.
- Keeping all imports eager was rejected as the long-term direction because
  one module import can prevent application bootstrap and bundle cost grows
  with every module.
- Shadow DOM was deferred because it complicates shared tokens, overlays,
  accessibility, and existing component composition.

## Validation

Require generated-catalog drift checks, per-module bundle budgets, cold and
cached navigation tests, simulated chunk 404/timeout/stale-deploy tests,
keyboard-accessible recovery, and style-leak fixtures across module surfaces.

## Rollback

The generator can return to eager imports without changing manifest ownership.
Rollback must preserve the existing per-surface render error boundary and must
not claim import-failure isolation.

## Revisit triggers

Revisit when accepting this proposal, bundle budgets fail, module code needs
independent deployment, or CSS collision evidence exceeds the scoped-style
approach.
