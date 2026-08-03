# UOK PostgreSQL Database Security

**Status:** Active foundation runbook; RLS activation is blocked

**Current candidate:** `UOK-3.1.0-alpha.3`

**Purpose:** Operate and verify the least-privileged PostgreSQL role and
tenant-policy foundation without overstating production readiness.

**Applies to:** offline inventory, disposable PostgreSQL 18 qualification,
reviewed staging activation, and future production role/RLS deployment.

## Current State

The local `127.0.0.1:18088` profile intentionally remains unchanged and uses
its local bootstrap role. Application-layer organization filters are active.
PostgreSQL RLS is not active.

The executable inventory currently classifies all 64 mapped tables: 61 direct
`organization_id` tables, Organizations by primary key, Users through
Memberships, and one global read-only schema-version table. The inventory and
foundation are readiness controls, not production tenant-isolation evidence.

## Offline Inventory

This command needs no database credential and does not change state:

```powershell
python scripts/verify_database_security.py
```

Exit code `0` means the ORM/manifest inventory is complete. The JSON still
reports `production_ready: false` and lists every activation blocker.

## Foundation Provisioning

Use only on a reviewed PostgreSQL staging or production-shaped target during a
maintenance window. Do not apply this script to the shared local candidate as
part of normal development.

Prerequisites:

1. Verified custom-format backup and restore command.
2. Captured table/schema owners, grants, role memberships, and policies.
3. A direct administrative connection from secret storage.
4. Production automatic schema creation, local seed, demo password reset, and
   self-registration disabled.
5. Review of the exact source commit and this ADR:
   `docs/architecture/ADR-0030-postgresql-least-privilege-and-tenant-rls-foundation.md`.

Apply with `psql` so `ON_ERROR_STOP` is honored:

```powershell
$env:PGURI = "<admin connection from secret storage>"
psql $env:PGURI -f deploy/postgres/database-security-foundation.sql
Remove-Item Env:\PGURI
```

The script creates only non-login group roles. It removes all pre-existing
memberships into or out of those roles and recreates only the exact
`uok_migrator -> uok_owner` edge with no admin or inherited privilege.
Therefore create deployment logins only after the live foundation gate passes.
Reapplying the foundation intentionally removes those login memberships and
requires reprovisioning them from the reviewed deployment plan.

Create deployment logins outside Git with generated credentials. The runtime
login must be a non-superuser, `INHERIT` member of only `uok_runtime`. The
migration login may assume `uok_migrator`; it must never be used by the API.

The foundation transfers schema/table ownership and converges grants. It first
revokes Public schema access plus every runtime table and sequence privilege.
It removes global Public/runtime `uok_owner` table and sequence defaults before
rebuilding the only declared schema-scoped defaults, because schema defaults
cannot cancel an unsafe global grant. The live gate observes every global and
schema-scoped `uok_owner` default ACL and rejects any undeclared row for
reviewed cleanup rather than silently revoking an arbitrary deployment role.
It then grants only runtime schema `USAGE` and rebuilds the closed object grant
set. It also drops every prior policy on the covered tables, creates exactly
one canonical fail-closed policy, and explicitly disables and unforces RLS.

## Live Foundation Verification

Use a dedicated administrative inspection URL. The command never renders it:

```powershell
$env:UOK_DATABASE_SECURITY_ADMIN_URL = "<admin connection from secret storage>"
python scripts/verify_database_security.py --live
Remove-Item Env:\UOK_DATABASE_SECURITY_ADMIN_URL
```

The live foundation gate requires:

- all ORM tables and PostgreSQL tables match exactly;
- `uok_owner`, `uok_migrator`, and `uok_runtime` exist with exact safe
  attributes;
- the complete membership graph contains only the exact migrator-to-owner
  edge, with no admin option or inherited privilege;
- public tables are owned by `uok_owner`;
- Public has no schema `USAGE` or `CREATE`, while `uok_runtime` has only
  schema `USAGE`;
- current table, sequence, and owner-default grants match the closed
  classification, including denial of `TRUNCATE`, `REFERENCES`, `TRIGGER`, and
  sequence `UPDATE`, with no global or other-schema owner-default ACL;
- every public policy is inspected and all 63 tenant tables have exactly one
  canonical, `uok_runtime`-only, fail-closed `USING` and `WITH CHECK`; and
- every table has RLS disabled and unforced in foundation mode, and schema
  versions have no tenant policy and remain read-only.

It does not require active RLS and therefore cannot return
`production_ready: true`.

## Active Qualification

There is intentionally no activation SQL in this candidate. Complete every
activation gate in ADR-0030 in one reviewable change before enabling RLS.
After that change, qualify with:

```powershell
$env:UOK_DATABASE_SECURITY_ADMIN_URL = "<admin connection from secret storage>"
python scripts/verify_database_security.py --live --expect-active `
  --runtime-login-role <deployment-login> `
  --migrator-login-role <migration-login> --require-cross-org-probe
Remove-Item Env:\UOK_DATABASE_SECURITY_ADMIN_URL
```

The guessed-ID probe is read-only. It requires two organizations and a user
exclusive to the foreign organization. It sets the local organization
transaction context, assumes `uok_runtime`, and requires foreign Organization,
Membership, and User lookups to return zero rows. No witness means failure,
not a skipped pass.

A passing active command reports `active_database_gate_ready: true`, while
`production_ready` remains false. The verifier cannot prove the separate
application write, transaction-context, exception-cleanup, pool-switching, IAM,
hosting, or operating-evidence gates required for production.

Module-level application tests remain mandatory because database RLS does not
replace authorization, object visibility, permissions, or redacted not-found
behavior.

## Failure and Rollback

- Never activate only a subset of tenant tables.
- Never grant the API owner, migrator, superuser, or `BYPASSRLS`.
- If provisioning fails, keep RLS disabled and stop promotion.
- Restore the captured ownership/grant state or verified database backup.
- Rerun database capacity, migration discipline, the security verifier, and
  the normal candidate gate before resuming.
- Preserve sanitized output under ignored `var/`; never store connection URLs
  or credentials in evidence.
