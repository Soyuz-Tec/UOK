# UOK Database Connection Pooling

**Status:** Active operations runbook.

**Current candidate:** `UOK-3.1.0-alpha.3`

## Current Topology

The current API connects directly to PostgreSQL 18 through one bounded
SQLAlchemy `QueuePool` per Uvicorn process. The local candidate runs one API
worker and one replica. PgBouncer is deliberately not deployed in this profile;
its activation conditions are recorded in
`docs/architecture/ADR-0024-database-connection-pooling.md`.

## Runtime Settings

| Environment setting | Local default | Validation and purpose |
|---|---:|---|
| `UOK_DB_POOL_SIZE` | `5` | Retained connections per process; integer 1-100 |
| `UOK_DB_MAX_OVERFLOW` | `10` | Temporary overflow per process; integer 0-100 |
| `UOK_DB_POOL_TIMEOUT_SECONDS` | `30` | Request checkout wait before generic 503; integer 1-300 |
| `UOK_DB_POOL_PRE_PING` | `1` | Validate a pooled connection before checkout |
| `UOK_DB_POOL_RECYCLE_SECONDS` | `0` | `0` or `-1` disables; otherwise 30-86400 |
| `UOK_DB_CONNECT_TIMEOUT_SECONDS` | `5` | New PostgreSQL connection timeout; integer 1-60 |
| `UOK_DB_APPLICATION_NAME` | `uok-api` | Safe 1-63 character PostgreSQL session identity |
| `UOK_API_WORKERS` | `1` | Capacity-calculation worker count |
| `UOK_API_REPLICAS` | `1` | Capacity-calculation replica count |
| `UOK_DB_DIRECT_TOOLS_RESERVE` | `15` | Mandatory minimum migration, verifier, and admin reserve |
| `UOK_DB_OPERATIONAL_HEADROOM` | `20` | Mandatory minimum unused operating headroom |

`UOK_API_WORKERS` must match the actual Uvicorn process count. The current
Docker command makes one worker explicit. Any orchestrator replica count must
be reflected in `UOK_API_REPLICAS` before running the gate.

The non-secret deployment policy is committed at
`deploy/database-capacity.env`. It is the pre-deploy source for the pool plan,
worker and replica declarations, mandatory reserve floors, and these
capacity-only PostgreSQL assumptions:

| Capacity-only setting | Default | Meaning |
|---|---:|---|
| `UOK_DB_MAX_CONNECTIONS` | `100` | Assumed offline PostgreSQL `max_connections` |
| `UOK_DB_SUPERUSER_RESERVED_CONNECTIONS` | `3` | Assumed offline superuser reserve |
| `UOK_DB_RESERVED_CONNECTIONS` | `0` | Assumed offline PostgreSQL general reserve |

Live mode replaces these three offline assumptions with current PostgreSQL
settings. The direct-tool reserve cannot be less than 15 and operational
headroom cannot be less than 20.

## Capacity Gate

Offline policy check:

```powershell
python scripts/verify_database_capacity.py --environment-file deploy/database-capacity.env
```

Run this command before building or deploying. It does not require a database
credential and fails if the committed deployment plan exceeds its declared
offline limit assumptions.

Live check against the running container's credential without rendering it:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action DatabaseCapacity
```

The standard action reads the same committed policy for its offline check and
then executes live mode inside `uok-api-1`. Exit code 0 passes, 1 means a
calculated or live cluster invariant failed, and 2 means configuration or live
inspection failed. Output uses schema `uok.database_capacity.v1` and contains
no database URL.

The current profile calculates:

```text
usable = 100 - 3 - 0 = 97
application = (5 + 10) * 1 * 1 = 15
reserved demand = 15 direct tools + 20 operating headroom
total demand = 50
remaining after demand = 47
```

Do not increase workers, replicas, pool size, or overflow unless both the
offline and live checks pass with the intended deployment values.

The live check replaces the offline PostgreSQL limit assumptions, inspects
client sessions across the cluster, and enforces all three conditions:

```text
UOK sessions <= declared application pool demand
non-UOK client sessions <= direct-tools reserve
actual usable connections remaining >= operational headroom
```

Its own inspection connection is excluded. The probe uses `NullPool`, a
bounded connect timeout, one read-only transaction, and closes its connection
after the single inspection so the verifier does not create another retained
pool.

## Pool Telemetry

The process-local snapshot is available only to an authenticated actor with
`architecture.read`:

```http
GET /api/architecture/database-pool
```

It reports backend and pool class, safe configuration, opened/closed
connections, checkouts/checkins, invalidations, timeouts, current checkouts, and
peak checkouts. It never reports the database URL, user, password, hostname, or
raw exception. Because authentication itself uses a database session, the
snapshot may include the telemetry request's own checkout.

Operational signals:

- investigate any pool timeout immediately;
- warn when process `checked_out` reaches 80 percent of its configured maximum;
- treat reaching the configured maximum or losing mandatory database headroom
  as critical;
- monitor transaction age separately because a long transaction pins a server
  connection even when an external pooler is present.

## Verification

Focused deterministic checks:

```powershell
python -m pytest tests/test_database_pool_hardening.py tests/test_database_capacity.py tests/test_database_capacity_live.py -q
python scripts/verify_database_capacity.py --environment-file deploy/database-capacity.env
```

Rebuild and deploy the local candidate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\uok_ops.ps1 -Action Rebuild
```

`Rebuild` runs the offline capacity check before Compose, waits for `/health`,
and then runs the live check. After deployment, authenticate as an operator and read the
pool telemetry endpoint, then confirm `uok-api` appears in the live session
groups.

### Controlled PostgreSQL Restart Recovery

Use only against the disposable local candidate:

1. Call `/health` several times to warm the API pool.
2. Restart only `uok-db-1`; do not restart the API container.
3. Wait for `pg_isready -U uok -d uok` to succeed inside the database container.
4. Call `/health` once. The first request must succeed through pre-ping recovery.
5. Read the authenticated telemetry. Invalidations or new connections may
   increase, checked-out count must return to its normal floor, and no
   credential may appear.
6. Rerun `DatabaseCapacity` and the candidate verifier.

This proves recovery of stale idle connections. It does not claim recovery of
an interrupted transaction; that transaction must fail and be retried only
through an approved command-level strategy.

### Saturation Evidence

The deterministic test creates a one-slot bounded QueuePool, holds its only
connection, proves the next checkout times out, releases it, and proves a later
checkout succeeds. For deployed load, use controlled concurrent API traffic and
the telemetry high-water/timeout counters. Do not create artificial saturation
against non-disposable data.

## PgBouncer Decision Gate

Open a separate deployment-hardening ADR and PR when one of these is true:

- approved worker/replica demand cannot preserve direct-tool and operational
  reserves;
- sustained checkout waits or timeouts occur at a healthy PostgreSQL server;
- connection churn or server connection pressure becomes material;
- the target platform mandates a managed external connection proxy.

The future runtime path may be API to PgBouncer transaction mode to PostgreSQL.
Migration, schema initialization, seed, backup, restore, and direct database
verifiers must bypass transaction pooling through a separate administration
URL. Production automatic schema creation and local seeding remain disabled.
Prepared statements, transaction-mode feature compatibility, least-privileged
roles, pool statistics, outage behavior, and rollback must be runtime-proven
before promotion.

## Rollback

If this hardening causes a regression:

1. Select or revert to the intended previously verified Git revision first.
2. Keep one API worker and one replica; never introduce unlimited overflow.
3. If that revision includes this hardening and the capacity verifier, rebuild
   it and run health plus `DatabaseCapacity`.
4. If it predates this hardening, run health and direct PostgreSQL readiness and
   connection-limit checks instead; do not invoke an action absent from that
   image.
5. Preserve telemetry and failure evidence under ignored `var/` paths.
6. Do not work around a failure by
   exposing database details, disabling capacity validation, or increasing
   PostgreSQL connections without a reviewed budget.
