# ADR-0024: Bounded Database Connection Pooling

**Status:** Accepted
**Date:** 2026-07-11
**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

The UOK API connected directly to PostgreSQL through SQLAlchemy's implicit
`QueuePool`. The defaults allowed five retained connections plus ten overflow
connections per process, but the limits, checkout timeout, stale-connection
handling, application identity, and operational budget were not explicit.
Every future Uvicorn worker or API replica would create another independent
pool, so horizontal scaling could multiply connections without a release gate.

The current local PostgreSQL 18 profile exposes 100 total connections, with
three reserved for superusers and none in `reserved_connections`. UOK must keep
capacity for migrations, verification tools, recovery, and operator access. It
must also preserve SQLite as the isolated test profile and must not introduce a
new deployment component without evidence that the simpler topology is
insufficient.

## Decision

1. PostgreSQL runtime access continues to use one process-local SQLAlchemy
   `QueuePool` per API process. PgBouncer is not part of the current candidate.
2. `src/uok/host/db_pool.py` owns validated PostgreSQL pool configuration. Pool size,
   overflow, checkout timeout, pre-ping, optional recycling, connect timeout,
   and application name are explicit and bounded. Unlimited pool or overflow
   settings fail closed.
3. The current profile preserves five retained connections and ten overflow
   connections per process, uses a 30-second checkout timeout, enables
   `pool_pre_ping`, uses a five-second connect timeout, and identifies sessions
   as `uok-api`. Recycling stays disabled until an infrastructure idle timeout
   provides a measured value.
4. SQLite keeps its existing test-specific connection arguments and does not
   consume the PostgreSQL pool settings.
5. Pool checkout/checkin, open/close, invalidation, timeout, current checkout,
   and peak checkout counters are process-local and credential-free. Actors
   with `architecture.read` may read them at
   `GET /api/architecture/database-pool`.
6. A request-time pool acquisition timeout returns a generic HTTP 503 with
   `Retry-After`; no database URL, credential, host, or driver exception is
   disclosed. Startup and direct-tool failures remain non-HTTP failures.
7. Application shutdown disposes the engine. Request sessions continue to use
   context-managed lifecycle and return connections on normal and exceptional
   exits.
8. The executable capacity formula is:

   ```text
   demand = (pool_size + max_overflow) * workers * replicas
            + direct_tools_reserve + operational_headroom
   demand <= max_connections - superuser_reserved_connections
             - reserved_connections
   ```

   The committed policy in `deploy/database-capacity.env` declares 15 as the
   minimum direct-tool reserve and 20 as the minimum operational headroom;
   neither may be reduced by an environment override. With one process, demand
   is 50 of 97 usable slots, leaving 47 unallocated slots. Worker or replica
   increases must pass offline policy before Compose and cluster-wide live
   inspection immediately after health before the deployment is accepted.
9. `scripts/verify_database_capacity.py` is the single calculator for CI and
   live operations. The offline pre-deploy gate reads the committed
   `deploy/database-capacity.env`, including assumed PostgreSQL limits of 100
   total, three superuser-reserved, and zero otherwise-reserved connections.
   Live mode replaces those three assumptions with PostgreSQL settings.
10. Live inspection is cluster-wide and uses a one-shot `NullPool` connection
    with a bounded connect timeout and read-only transaction. It excludes its
    own session, groups client sessions by application name/state, warns when
    the inspected role is superuser, and never renders the database URL. It
    fails unless UOK sessions are within declared application demand, non-UOK
    client sessions are within the direct-tool reserve, and actual remaining
    usable connections preserve the operational headroom.
11. Long Planning analysis, report, and locked command transactions remain
    bounded but may retain a checked-out server connection while working.
    Pooling does not replace transaction-duration measurement or refactoring.

## PgBouncer Activation Boundary

PgBouncer requires a separate architecture and deployment change. Consider it
when approved worker/replica demand cannot preserve the reserved budget, or
when telemetry shows sustained checkout waits/timeouts, excessive connection
churn, or PostgreSQL connection pressure.

If activated:

- normal API traffic may use PgBouncer transaction pooling;
- migration, schema initialization, seed, backup, restore, and direct locking
  verifiers must use a separate direct PostgreSQL administration URL;
- production startup must keep automatic schema creation and local seeding off;
- SQLAlchemy must use `NullPool` or a deliberately small bounded client pool so
  two pooling layers cannot multiply capacity silently;
- Psycopg automatic prepared statements require PgBouncer 1.22 or newer with a
  nonzero `max_prepared_statements` and compatible libpq, or preparation must
  be disabled deliberately;
- row-lock, rollback, replay/purge, analysis, reconnect, prepared-statement,
  outage, and `SHOW POOLS`/`SHOW STATS` evidence must pass before cutover;
- session `SET`, `LISTEN`, session advisory locks, persistent temporary tables,
  and other transaction-pooling-incompatible features remain prohibited.

## Consequences

- Current behavior is explicit, observable, restart-tolerant at checkout, and
  bounded without adding a new availability or authentication component.
- Each API process still owns an independent pool; capacity approval remains a
  deployment requirement.
- Pre-ping can recover a stale idle connection before a request uses it, but it
  cannot recover a transaction interrupted by a database outage. Whole
  transaction retry remains an application decision.
- The authenticated snapshot is process-local. Multi-replica aggregation needs
  an external metrics system in a later observability increment.
- The current local database role is intentionally convenient for candidate
  work and emits a superuser warning. Production must use a least-privileged
  runtime role separate from migration administration.

## Alternatives Considered

- **Add PgBouncer immediately.** Deferred because one current API process uses a
  maximum of 15 of 97 ordinary slots and there is no observed exhaustion. The
  new component would add authentication, monitoring, failover, prepared-plan,
  and direct-migration routing obligations before they are necessary.
- **Keep implicit SQLAlchemy defaults.** Rejected because worker/replica
  multiplication, stale-connection behavior, and capacity could drift without
  reviewable configuration or evidence.
- **Disable pooling.** Rejected for the direct-PostgreSQL profile because it
  would add connection setup cost and remove application concurrency control.
- **Raise PostgreSQL `max_connections`.** Rejected as a first response because
  it increases server resource use without controlling application demand.

## Validation

- Unit tests cover defaults, overrides, invalid and unbounded input, exact
  QueuePool construction, telemetry safety, saturation timeout/release,
  authenticated status, generic 503 behavior, SQLite compatibility, and engine
  disposal.
- The capacity tests cover passing and failing budgets, mandatory reserve
  floors, committed environment-file loading, invalid inputs, offline
  deterministic output, cluster-wide live invariants, one-shot read-only
  inspection, session grouping, role warning, and credential redaction.
- `DatabaseCapacity` runs both offline and live checks; `Rebuild` runs offline
  policy before Compose and live inspection after health succeeds.
- Deployment verification warms the pool, restarts PostgreSQL without
  restarting the API, requires the first post-recovery health request to pass,
  and confirms `uok-api` session identity plus bounded connection counts.
