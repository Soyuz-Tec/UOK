# ADR-0031: PostgreSQL Least Privilege and Tenant RLS Foundation

**Status:** Accepted foundation; activation deferred

**Implementation status:** Inactive; foundation and offline verification exist, but RLS is not enabled

**Date:** 2026-07-24

**Current candidate:** `UOK-3.1.0-alpha.3`

## Context

UOK currently enforces organization ownership in application queries and
commands. Those checks have broad guessed-ID and cross-organization test
coverage, but they do not provide PostgreSQL row-level security (RLS). The
local Compose profile also connects as the convenient database bootstrap
superuser. Neither property is acceptable as a production claim.

The host composes 64 SQLAlchemy tables from kernel models and module manifests.
Executable metadata inspection finds:

- 61 tables with a non-null `organization_id` foreign key to
  `organizations.id`;
- `organizations`, whose tenant key is its primary key;
- `users`, whose tenant visibility is derived through `memberships`; and
- `schema_versions`, which is global read-only release metadata.

The current login endpoint looks up a User before it knows the selected
organization, self-registration creates identity and membership rows, and
pooled request sessions do not set a transaction-local tenant context.
Enabling RLS before those boundaries change would break authentication.
Session-scoped context could also survive a pooled checkout if it were not
strictly transaction-local and reset on every path.

## Decision

1. `src/uok/database_security.py` is the executable database-security
   inventory. It derives table ownership from the validated module model
   registry and classifies every mapped table. An unknown non-tenant table,
   unclaimed owner, nullable tenant key, or tenant key without the exact
   organization foreign key fails closed.
2. Production PostgreSQL uses three fixed non-login group roles:
   - `uok_owner` owns the schema and objects;
   - `uok_migrator` may assume `uok_owner`; and
   - `uok_runtime` receives bounded application privileges and cannot assume
     either elevated role.
   All three are non-superuser, non-`BYPASSRLS`, non-create, non-replication
   roles. Provisioning removes every pre-existing incoming and outgoing
   membership involving these roles, then recreates only the non-admin,
   non-inherited, settable `uok_migrator -> uok_owner` edge. A
   deployment-specific login may inherit only `uok_runtime`.
3. `deploy/postgres/database-security-foundation.sql` is a reviewed
   provisioning script, not an automatically applied application migration.
   It removes Public schema/object privileges, grants schema `USAGE` only to
   the runtime role, transfers public schema and
   table ownership to `uok_owner`, revokes all pre-existing runtime table and
   sequence privileges, and removes global Public/runtime owner defaults
   before applying schema-scoped defaults. The live verifier observes every
   global and schema-scoped owner default and rejects any undeclared ACL for
   reviewed cleanup rather than silently changing an arbitrary deployment
   role.
   The script then grants runtime DML only on tenant-owned application tables.
   Organizations, Users, and schema versions remain read-only; `TRUNCATE`,
   `REFERENCES`, `TRIGGER`, sequence `UPDATE`, grant options, and undeclared
   defaults remain denied.
4. The foundation creates one single-role, fail-closed
   `uok_tenant_isolation` policy on every tenant-scoped table:
   - direct tables compare `organization_id` with the transaction setting
     `uok.organization_id`;
   - Organizations compares `id` with that setting; and
   - Users requires a membership in that organization.
   Missing or empty context evaluates to false. Schema versions remain global
   and read-only.
5. Provisioning removes every pre-existing policy on each tenant table and
   recreates exactly one canonical policy for exactly `uok_runtime`. It also
   disables and unforces RLS, including on schema versions, so the foundation
   converges to a dormant state. UOK must not ship an activation script until
   the authentication, self-registration, actor-context, and pool-cleanup
   gates below are implemented and qualified.
6. `scripts/verify_database_security.py` provides three evidence levels:
   - offline metadata inventory;
   - live foundation verification of exact tables, every protected/reachable
     role-membership edge, ownership, current/default table and sequence
     grants, and every public policy; and
   - active database-gate qualification requiring enabled and forced RLS, a
     safe runtime login, dormant RLS on global tables, and a mandatory
     two-organization guessed-ID probe. This gate never claims whole-system
     production readiness.
7. SQLite remains the isolated test fallback. The inventory reads SQLAlchemy
   metadata only, and PostgreSQL-specific provisioning and live verification
   are never executed by SQLite startup or tests.

## RLS Activation Gate

RLS may be enabled only after one reviewed change proves all of the following:

1. The signed actor organization is established before every tenant-protected
   query, including authentication and membership validation.
2. `set_config('uok.organization_id', ..., true)` is transaction-local, occurs
   on every request and worker transaction, and missing/error/cancel paths
   cannot reuse a prior tenant context from the pool.
3. Login uses a bounded authentication function or external identity provider.
   Production self-registration is disabled or redesigned for RLS.
4. The application connects through a dedicated login that inherits only
   `uok_runtime`; schema initialization and seed behavior are disabled.
5. Every one of the 63 tenant-scoped tables has exactly one canonical
   fail-closed policy, no additional permissive policy, and both
   `ENABLE ROW LEVEL SECURITY` and
   `FORCE ROW LEVEL SECURITY`.
6. PostgreSQL integration tests prove no-context denial, same-tenant reads and
   writes, cross-tenant guessed-ID denial, insert/update tenant mismatch
   denial, transaction rollback, exception cleanup, and pooled-connection
   tenant switching.
7. The active live verifier passes with two real staging organizations and an
   exclusive foreign user witness.

The custom PostgreSQL setting is defense in depth against omitted tenant
filters. It does not make raw SQL injection safe: input validation,
parameterized SQL, narrow grants, and application security controls remain
mandatory.

## Consequences

- Table, policy, role-graph, current-grant, sequence-grant, and default-grant
  drift is now machine-detectable without changing local runtime behavior.
- A production-shaped least-privilege role topology is reviewable and
  executable, while credentials remain deployment-owned and absent from Git.
- Applying the foundation changes object ownership and grants. It therefore
  requires a backup, an ownership snapshot, maintenance coordination, and live
  verification even though it does not activate RLS.
- UOK still does not claim production tenant isolation. Application filters
  remain the active control until every activation gate passes.

## Alternatives Considered

- **Enable RLS immediately.** Rejected because current login and pooled-session
  context are not compatible and a partial rollout would be misleading.
- **Protect only newly added business tables.** Rejected because partial RLS
  can create false confidence. The inventory covers every mapped table.
- **Keep only application filters.** Rejected as the production target because
  one missed filter would remain a direct cross-organization exposure.
- **Create one database role per organization.** Deferred because it adds
  identity lifecycle, pool fragmentation, and migration complexity not
  justified by the current modular-monolith topology.

## Validation

```powershell
python scripts/verify_database_security.py
python -m pytest tests/test_database_security_inventory.py tests/test_database_security_live.py -q
```

After applying the foundation to a reviewed PostgreSQL target:

```powershell
$env:UOK_DATABASE_SECURITY_ADMIN_URL = "<admin connection from secret storage>"
python scripts/verify_database_security.py --live
```

The future activation change must additionally pass:

```powershell
python scripts/verify_database_security.py --live --expect-active `
  --runtime-login-role <deployment-login> `
  --migrator-login-role <migration-login> --require-cross-org-probe
```

## Rollback

Do not apply the foundation automatically. Before applying it, capture the
current owners, grants, policies, and a verified database backup. If foundation
verification fails, keep RLS disabled, stop application promotion, restore the
reviewed ownership/grant snapshot or database backup, and rerun the normal
database capacity and candidate gates. Never work around a failure by granting
the runtime login owner, migrator, superuser, or `BYPASSRLS`.
