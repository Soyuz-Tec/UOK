from __future__ import annotations

from collections.abc import Callable
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool


VERIFIER_APPLICATION_NAME = "uok-database-security-verifier"
ROLE_SQL = """
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin,
       rolreplication, rolbypassrls
FROM pg_roles
ORDER BY rolname
"""
ROLE_MEMBERSHIP_SQL = """
SELECT
    granted.rolname AS role_name,
    member.rolname AS member_name,
    grantor.rolname AS grantor_name,
    membership.admin_option,
    membership.inherit_option,
    membership.set_option
FROM pg_auth_members AS membership
JOIN pg_roles AS granted ON granted.oid = membership.roleid
JOIN pg_roles AS member ON member.oid = membership.member
JOIN pg_roles AS grantor ON grantor.oid = membership.grantor
ORDER BY granted.rolname, member.rolname
"""
TABLE_SQL = """
SELECT c.relname AS table_name,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname
"""
POLICY_SQL = """
SELECT tablename AS table_name, policyname, permissive, roles, cmd, qual,
       with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname
"""
PRIVILEGE_SQL = """
SELECT c.relname AS table_name,
       has_table_privilege('uok_runtime', c.oid, 'SELECT') AS can_select,
       has_table_privilege('uok_runtime', c.oid, 'INSERT') AS can_insert,
       has_table_privilege('uok_runtime', c.oid, 'UPDATE') AS can_update,
       has_table_privilege('uok_runtime', c.oid, 'DELETE') AS can_delete,
       has_table_privilege('uok_runtime', c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege('uok_runtime', c.oid, 'REFERENCES') AS can_references,
       has_table_privilege('uok_runtime', c.oid, 'TRIGGER') AS can_trigger
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname
"""
SEQUENCE_PRIVILEGE_SQL = """
SELECT c.relname AS sequence_name,
       has_sequence_privilege('uok_runtime', c.oid, 'USAGE') AS can_usage,
       has_sequence_privilege('uok_runtime', c.oid, 'SELECT') AS can_select,
       has_sequence_privilege('uok_runtime', c.oid, 'UPDATE') AS can_update
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'S'
ORDER BY c.relname
"""
DEFAULT_PRIVILEGE_SQL = """
SELECT owner.rolname AS owner_name,
       COALESCE(namespace.nspname, '<global>') AS schema_name,
       defaults.defaclobjtype AS object_type,
       COALESCE(granted.rolname, 'PUBLIC') AS grantee_name,
       privileges.privilege_type,
       privileges.is_grantable
FROM pg_default_acl AS defaults
JOIN pg_roles AS owner ON owner.oid = defaults.defaclrole
LEFT JOIN pg_namespace AS namespace ON namespace.oid = defaults.defaclnamespace
CROSS JOIN LATERAL aclexplode(defaults.defaclacl) AS privileges
LEFT JOIN pg_roles AS granted ON granted.oid = privileges.grantee
WHERE owner.rolname = 'uok_owner'
ORDER BY schema_name, defaults.defaclobjtype, grantee_name,
         privileges.privilege_type
"""
SCHEMA_PRIVILEGE_SQL = """
SELECT n.nspname AS schema_name,
       pg_get_userbyid(n.nspowner) AS owner_name,
       has_schema_privilege('uok_runtime', n.oid, 'USAGE')
           AS runtime_can_usage,
       has_schema_privilege('uok_runtime', n.oid, 'CREATE')
           AS runtime_can_create,
       has_schema_privilege('PUBLIC', n.oid, 'USAGE')
           AS public_can_usage,
       has_schema_privilege('PUBLIC', n.oid, 'CREATE')
           AS public_can_create
FROM pg_namespace AS n
WHERE n.nspname = 'public'
"""
WITNESS_SQL = """
SELECT local_membership.organization_id AS local_organization_id,
       foreign_membership.organization_id AS foreign_organization_id,
       foreign_membership.user_id AS foreign_user_id
FROM memberships AS local_membership
JOIN memberships AS foreign_membership
  ON foreign_membership.organization_id <> local_membership.organization_id
WHERE NOT EXISTS (
    SELECT 1
    FROM memberships AS local_user_membership
    WHERE local_user_membership.organization_id =
          local_membership.organization_id
      AND local_user_membership.user_id = foreign_membership.user_id
)
ORDER BY local_membership.organization_id, foreign_membership.organization_id
LIMIT 1
"""


class LiveDatabaseSecurityError(RuntimeError):
    pass


def inspect_live_database_security(
    database_url: str,
    *,
    run_cross_org_probe: bool = False,
    connect_timeout_seconds: int = 5,
    engine_factory: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    if not database_url.strip():
        raise LiveDatabaseSecurityError(
            "UOK_DATABASE_SECURITY_ADMIN_URL is required for live inspection"
        )
    if not 1 <= connect_timeout_seconds <= 60:
        raise LiveDatabaseSecurityError("connect timeout must be between 1 and 60")
    factory = engine_factory or create_engine
    engine = None
    try:
        engine = factory(
            database_url,
            future=True,
            poolclass=NullPool,
            connect_args={
                "application_name": VERIFIER_APPLICATION_NAME,
                "connect_timeout": connect_timeout_seconds,
            },
        )
        if getattr(getattr(engine, "dialect", None), "name", None) != "postgresql":
            raise LiveDatabaseSecurityError("live inspection requires PostgreSQL")
        with engine.connect() as connection:
            with connection.begin():
                connection.exec_driver_sql("SET TRANSACTION READ ONLY")
                roles = _mapping_rows(connection.exec_driver_sql(ROLE_SQL))
                role_names = {str(row["rolname"]) for row in roles}
                tables = _mapping_rows(connection.exec_driver_sql(TABLE_SQL))
                policies = _mapping_rows(connection.exec_driver_sql(POLICY_SQL))
                memberships = (
                    _mapping_rows(connection.exec_driver_sql(ROLE_MEMBERSHIP_SQL))
                    if {"uok_owner", "uok_migrator", "uok_runtime"}.issubset(role_names)
                    else []
                )
                privileges = (
                    _mapping_rows(connection.exec_driver_sql(PRIVILEGE_SQL))
                    if "uok_runtime" in role_names
                    else []
                )
                sequence_privileges = (
                    _mapping_rows(connection.exec_driver_sql(SEQUENCE_PRIVILEGE_SQL))
                    if "uok_runtime" in role_names
                    else []
                )
                default_privileges = (
                    _mapping_rows(connection.exec_driver_sql(DEFAULT_PRIVILEGE_SQL))
                    if "uok_runtime" in role_names
                    else []
                )
                schema_privileges = (
                    _mapping_rows(connection.exec_driver_sql(SCHEMA_PRIVILEGE_SQL))
                    if "uok_runtime" in role_names
                    else []
                )
                cross_org_probe = (
                    _cross_org_probe(connection)
                    if run_cross_org_probe and "uok_runtime" in role_names
                    else None
                )
        return {
            "roles": roles,
            "role_memberships": memberships,
            "tables": tables,
            "policies": policies,
            "privileges": privileges,
            "sequence_privileges": sequence_privileges,
            "default_privileges": default_privileges,
            "schema_privileges": schema_privileges,
            "cross_org_probe": cross_org_probe,
        }
    except LiveDatabaseSecurityError:
        raise
    except Exception as error:
        raise LiveDatabaseSecurityError(
            "live database security inspection failed"
        ) from error
    finally:
        if engine is not None:
            engine.dispose()


def _cross_org_probe(connection: Any) -> dict[str, Any]:
    witness = _mapping_optional(connection.exec_driver_sql(WITNESS_SQL))
    if witness is None:
        return {"ok": False, "witness_found": False, "checks": {}}
    local_id = str(witness["local_organization_id"])
    foreign_id = str(witness["foreign_organization_id"])
    foreign_user_id = str(witness["foreign_user_id"])
    connection.exec_driver_sql("SET LOCAL ROLE uok_runtime")
    connection.execute(
        text("SELECT set_config('uok.organization_id', :organization_id, true)"),
        {"organization_id": local_id},
    )
    checks = {
        "foreign_organization_hidden": _count(
            connection,
            "SELECT count(*) FROM organizations WHERE id = :value",
            foreign_id,
        )
        == 0,
        "foreign_membership_hidden": _count(
            connection,
            "SELECT count(*) FROM memberships WHERE organization_id = :value",
            foreign_id,
        )
        == 0,
        "foreign_exclusive_user_hidden": _count(
            connection,
            "SELECT count(*) FROM users WHERE id = :value",
            foreign_user_id,
        )
        == 0,
    }
    return {
        "ok": all(checks.values()),
        "witness_found": True,
        "checks": checks,
    }


def _count(connection: Any, statement: str, value: str) -> int:
    return int(connection.execute(text(statement), {"value": value}).scalar_one())


def _mapping_rows(result: Any) -> list[dict[str, Any]]:
    return [dict(row) for row in result.mappings().all()]


def _mapping_optional(result: Any) -> dict[str, Any] | None:
    row = result.mappings().one_or_none()
    return None if row is None else dict(row)


__all__ = [
    "LiveDatabaseSecurityError",
    "inspect_live_database_security",
]
