# ADR-0036: Fault Containment, Availability, and Health Boundaries

**Status:** Accepted

**Implementation status:** Partial

**Date:** 2026-08-09

**Owners:** UOK architecture maintainers

**Relations:** Related to ADR-0023, ADR-0028, and ADR-0041

## Context

UOK needs a precise answer to what keeps one module failure from taking down
the rest of the workspace. The current system is a modular monolith: module
frontend surfaces are compiled into one Vite application, backend routers run
inside one FastAPI process and worker, and modules share PostgreSQL. Calling
this a micro-frontend architecture or claiming independent service failure
domains would overstate current behavior.

The frontend registry already wraps every visited module surface in its own
React error boundary. The backend exposes separate liveness and readiness
probes, and the container health check uses readiness. These controls contain
some failures but not all failure classes.

## Decision

1. The supported frontend containment boundary is one already-loaded module
   surface. An uncaught React render/lifecycle error in that surface replaces
   only that surface with a retryable error state; the shell and sibling
   surfaces remain mounted.
2. Module data and command failures use owner-local asynchronous error states
   and request authority. They must not clear another module's state or grant
   authority through a client fallback.
3. `/health/live` reports that the API process can answer. `/health/ready`
   verifies database connectivity and schema compatibility. An orchestrator
   may stop routing to an unready instance and restart a failed instance.
4. UOK makes no current claim that an import/bootstrap error, exhausted browser
   resources, JavaScript event-loop failure, Python process crash, shared-pool
   exhaustion, migration incompatibility, or PostgreSQL outage is isolated to
   one module.
5. Stronger isolation must follow evidence: first remove shared-state and
   ownership coupling, then choose a worker, process, service, or deployment
   boundary in a new ADR. A framework label alone is not isolation.

## Consequences

- The user-facing statement "the rest of the workspace is still available" is
  accurate only for a contained module render error after the bundle loads.
- The current controls are inexpensive and preserve the modular-monolith
  deployment model.
- Backend and dependency failures can still affect every module. Availability
  therefore depends on deployment replicas, readiness routing, database
  recovery, and resource limits that are not yet production-qualified.

## Alternatives

- Independent micro-frontends were not selected because current manifests
  generate eager imports into one bundle and there is no independent deploy or
  runtime contract.
- Per-module services were not selected because modules share transactions,
  identity, command contracts, and one database; splitting processes now would
  add distributed failure modes without proven need.
- A centralized event-driven core was not selected. ADR-0019 records a
  module-local transactional outbox but no delivery system.

## Validation

- `web/src/features/modules/moduleSurfaceRegistry.test.tsx` proves a crashing
  module surface is replaced and that explicit retry can remount the surface;
  the retained-surface test proves sibling ownership remains mounted.
- `tests/test_health_probes.py` proves the liveness/readiness distinction and
  database failure behavior.
- `tests/test_container_health_policy.py` proves the runtime health check uses
  readiness and an explicit single API worker.
- Fault injection for browser-process, API-process, pool, and PostgreSQL
  failures remains required before claiming production availability.

## Rollback

The error boundary and probe split can be reverted independently if they cause
a regression, but the previous behavior has weaker containment and deployment
signal quality. Rollback must also update the container health check, tests,
operations guide, and this registry.

## Revisit triggers

Revisit when module code is delivered independently, the API runs multiple
workers or replicas, a module requires a separate process, or production SLOs
cannot be met with the modular-monolith boundary.
