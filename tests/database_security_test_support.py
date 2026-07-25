from __future__ import annotations

import sys
from pathlib import Path

from uok.database_security import database_security_inventory


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import database_security_evaluation as evaluation  # noqa: E402


def database_security_observations(*, active: bool) -> dict[str, object]:
    inventory = database_security_inventory()
    roles = [
        _group_role(name)
        for name in (
            "uok_migrator",
            "uok_owner",
            "uok_runtime",
        )
    ]
    if active:
        roles.append(_runtime_login_role())
    tables = [
        {
            "table_name": row["table"],
            "owner": "uok_owner",
            "rls_enabled": active and row["tenant_scoped"],
            "rls_forced": active and row["tenant_scoped"],
        }
        for row in inventory["tables"]
    ]
    privileges = [
        {
            "table_name": row["table"],
            "can_select": True,
            "can_insert": row["table"] not in evaluation.READ_ONLY_TABLES,
            "can_update": row["table"] not in evaluation.READ_ONLY_TABLES,
            "can_delete": row["table"] not in evaluation.READ_ONLY_TABLES,
            "can_truncate": False,
            "can_references": False,
            "can_trigger": False,
        }
        for row in inventory["tables"]
    ]
    policies = [
        {
            "table_name": row["table"],
            "policyname": "uok_tenant_isolation",
            "permissive": "PERMISSIVE",
            "roles": ["uok_runtime"],
            "cmd": "ALL",
            "qual": _policy_expression(row),
            "with_check": _policy_expression(row),
        }
        for row in inventory["tables"]
        if row["tenant_scoped"]
    ]
    memberships = [
        {
            "role_name": "uok_owner",
            "member_name": "uok_migrator",
            "grantor_name": "postgres",
            "admin_option": False,
            "inherit_option": False,
            "set_option": True,
        }
    ]
    if active:
        memberships.append(
            {
                "role_name": "uok_runtime",
                "member_name": "uok_app",
                "grantor_name": "postgres",
                "admin_option": False,
                "inherit_option": True,
                "set_option": True,
            }
        )
    return {
        "roles": roles,
        "role_memberships": memberships,
        "tables": tables,
        "policies": policies,
        "privileges": privileges,
        "sequence_privileges": [
            {
                "sequence_name": "example_sequence",
                "can_usage": True,
                "can_select": True,
                "can_update": False,
            }
        ],
        "default_privileges": [
            {
                "schema_name": "public",
                "owner_name": "uok_owner",
                "object_type": object_type,
                "grantee_name": "uok_runtime",
                "privilege_type": privilege,
                "is_grantable": False,
            }
            for object_type, privilege in (
                ("r", "DELETE"),
                ("r", "INSERT"),
                ("r", "SELECT"),
                ("r", "UPDATE"),
                ("S", "SELECT"),
                ("S", "USAGE"),
            )
        ],
        "schema_privileges": [
            {
                "schema_name": "public",
                "owner_name": "uok_owner",
                "runtime_can_usage": True,
                "runtime_can_create": False,
                "public_can_usage": False,
                "public_can_create": False,
            }
        ],
        "cross_org_probe": {
            "ok": True,
            "witness_found": True,
            "checks": {
                "foreign_organization_hidden": True,
                "foreign_membership_hidden": True,
                "foreign_exclusive_user_hidden": True,
            },
        },
    }


def _group_role(name: str) -> dict[str, object]:
    return {
        "rolname": name,
        "rolsuper": False,
        "rolinherit": False,
        "rolcreaterole": False,
        "rolcreatedb": False,
        "rolcanlogin": False,
        "rolreplication": False,
        "rolbypassrls": False,
    }


def _runtime_login_role() -> dict[str, object]:
    return {
        **_group_role("uok_app"),
        "rolinherit": True,
        "rolcanlogin": True,
    }


def _policy_expression(row: dict[str, object]) -> str:
    context = "NULLIF(current_setting('uok.organization_id', true), '')"
    if row["isolation"] == "direct":
        return f"organization_id = {context}"
    if row["isolation"] == "organization_key":
        return f"id = {context}"
    return (
        "EXISTS (SELECT 1 FROM memberships membership "
        "WHERE membership.user_id = users.id "
        f"AND membership.organization_id = {context})"
    )


__all__ = ["database_security_observations"]
