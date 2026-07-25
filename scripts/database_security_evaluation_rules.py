from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Mapping
from typing import Any


GROUP_ROLES = {"uok_owner", "uok_migrator", "uok_runtime"}
UNSAFE_ROLE_FIELDS = (
    "rolsuper",
    "rolcreaterole",
    "rolcreatedb",
    "rolreplication",
    "rolbypassrls",
)


def group_roles_safe(roles: Mapping[str, Mapping[str, Any]]) -> bool:
    return GROUP_ROLES.issubset(roles) and all(
        role.get("rolcanlogin") is False
        and role.get("rolinherit") is False
        and all(role.get(field) is False for field in UNSAFE_ROLE_FIELDS)
        for name, role in roles.items()
        if name in GROUP_ROLES
    )


def login_role_valid(
    role: Mapping[str, Any] | None,
    *,
    inherit: bool,
) -> bool:
    return (
        role is not None
        and role.get("rolcanlogin") is True
        and role.get("rolinherit") is inherit
        and all(role.get(field) is False for field in UNSAFE_ROLE_FIELDS)
    )


def role_graph_valid(
    memberships: list[dict[str, Any]],
    *,
    runtime_login_role: str | None,
    migrator_login_role: str | None,
) -> bool:
    expected = {
        ("uok_owner", "uok_migrator", False, False, True),
    }
    protected = set(GROUP_ROLES)
    if runtime_login_role:
        protected.add(runtime_login_role)
        expected.add(("uok_runtime", runtime_login_role, False, True, True))
    if migrator_login_role:
        protected.add(migrator_login_role)
        expected.add(("uok_migrator", migrator_login_role, False, False, True))
    observed = {
        (
            str(row["role_name"]),
            str(row["member_name"]),
            bool(row["admin_option"]),
            bool(row["inherit_option"]),
            bool(row["set_option"]),
        )
        for row in memberships
        if row["role_name"] in protected or row["member_name"] in protected
    }
    return observed == expected


def policies_valid(
    table_inventory: list[dict[str, Any]],
    policies: list[dict[str, Any]],
) -> bool:
    expected = {
        str(row["table"]): row for row in table_inventory if row["tenant_scoped"]
    }
    by_table: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for policy in policies:
        by_table[str(policy["table_name"])].append(policy)
    if set(by_table) != set(expected):
        return False
    for table_name, table in expected.items():
        rows = by_table[table_name]
        if len(rows) != 1:
            return False
        row = rows[0]
        expression = _expected_policy_expression(table)
        if (
            row.get("policyname") != "uok_tenant_isolation"
            or row.get("permissive") != "PERMISSIVE"
            or row.get("cmd") != "ALL"
            or {str(role) for role in row.get("roles", [])} != {"uok_runtime"}
            or _normalize_expression(row.get("qual")) != expression
            or _normalize_expression(row.get("with_check")) != expression
        ):
            return False
    return bool(expected)


def _expected_policy_expression(table: Mapping[str, Any]) -> str:
    context = "NULLIF(current_setting('uok.organization_id', true), '')"
    isolation = table["isolation"]
    if isolation == "direct":
        source = f"organization_id = {context}"
    elif isolation == "organization_key":
        source = f"id = {context}"
    elif isolation == "membership_join":
        source = (
            "EXISTS (SELECT 1 FROM memberships membership "
            "WHERE membership.user_id = users.id "
            f"AND membership.organization_id = {context})"
        )
    else:
        raise ValueError(f"unsupported tenant policy classification: {isolation}")
    return _normalize_expression(source)


def _normalize_expression(value: object) -> str:
    if not isinstance(value, str):
        return ""
    without_casts = re.sub(r"::(?:text|character varying)", "", value.lower())
    return re.sub(r"[\s()]+", "", without_casts)


__all__ = [
    "GROUP_ROLES",
    "group_roles_safe",
    "login_role_valid",
    "policies_valid",
    "role_graph_valid",
]
