from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from database_security_acl import (
    default_privileges_valid,
    schema_privileges_valid,
    sequence_privileges_valid,
    table_privileges_valid,
)
from database_security_evaluation_rules import (
    GROUP_ROLES,
    group_roles_safe,
    login_role_valid,
    policies_valid,
    role_graph_valid,
)


@dataclass(frozen=True, slots=True)
class SecurityEvaluationContext:
    expected_tables: dict[str, dict[str, Any]]
    tenant_tables: set[str]
    roles: dict[str, dict[str, Any]]
    live_tables: dict[str, dict[str, Any]]
    privileges: dict[str, dict[str, Any]]


def build_security_evaluation_context(
    inventory: Mapping[str, Any],
    observations: Mapping[str, Any],
) -> SecurityEvaluationContext:
    return SecurityEvaluationContext(
        expected_tables={str(row["table"]): row for row in inventory["tables"]},
        tenant_tables=set(inventory["tenant_tables"]),
        roles={str(row["rolname"]): row for row in observations["roles"]},
        live_tables={str(row["table_name"]): row for row in observations["tables"]},
        privileges={str(row["table_name"]): row for row in observations["privileges"]},
    )


def common_security_checks(
    inventory: Mapping[str, Any],
    observations: Mapping[str, Any],
    context: SecurityEvaluationContext,
    *,
    runtime_login_role: str | None,
    migrator_login_role: str | None,
) -> dict[str, bool]:
    return {
        "metadata_inventory_valid": bool(inventory["ok"]),
        "database_tables_match_metadata": (
            set(context.live_tables) == set(context.expected_tables)
        ),
        "group_roles_present": GROUP_ROLES.issubset(context.roles),
        "group_roles_have_safe_attributes": group_roles_safe(context.roles),
        "role_membership_graph_is_closed": role_graph_valid(
            observations["role_memberships"],
            runtime_login_role=runtime_login_role,
            migrator_login_role=migrator_login_role,
        ),
        "tables_owned_by_non_login_owner": (
            bool(context.live_tables)
            and all(row["owner"] == "uok_owner" for row in context.live_tables.values())
        ),
        "runtime_table_privileges_are_closed": table_privileges_valid(
            context.expected_tables,
            context.privileges,
        ),
        "runtime_sequence_privileges_are_closed": sequence_privileges_valid(
            observations["sequence_privileges"]
        ),
        "runtime_default_privileges_are_closed": default_privileges_valid(
            observations["default_privileges"]
        ),
        "runtime_schema_privileges_are_closed": schema_privileges_valid(
            observations["schema_privileges"]
        ),
        "tenant_policy_set_is_exact": policies_valid(
            inventory["tables"],
            observations["policies"],
        ),
    }


def mode_security_checks(
    observations: Mapping[str, Any],
    context: SecurityEvaluationContext,
    *,
    expect_active: bool,
    runtime_login_role: str | None,
    migrator_login_role: str | None,
    require_cross_org_probe: bool,
) -> dict[str, bool]:
    if not expect_active:
        return {
            "rls_disabled_and_unforced_for_all_tables": (
                bool(context.live_tables)
                and all(
                    row["rls_enabled"] is False and row["rls_forced"] is False
                    for row in context.live_tables.values()
                )
            )
        }
    checks = {
        "rls_enabled_and_forced_for_all_tenant_tables": (
            context.tenant_tables.issubset(context.live_tables)
            and all(
                context.live_tables[name]["rls_enabled"] is True
                and context.live_tables[name]["rls_forced"] is True
                for name in context.tenant_tables
            )
        ),
        "rls_disabled_for_all_global_tables": all(
            context.live_tables[name]["rls_enabled"] is False
            and context.live_tables[name]["rls_forced"] is False
            for name in set(context.live_tables) - context.tenant_tables
        ),
        "runtime_login_is_safe_and_bounded": login_role_valid(
            context.roles.get(runtime_login_role or ""),
            inherit=True,
        ),
    }
    if migrator_login_role:
        checks["migrator_login_is_safe_and_bounded"] = login_role_valid(
            context.roles.get(migrator_login_role),
            inherit=False,
        )
    probe = observations["cross_org_probe"]
    checks["cross_organization_guessed_id_probe"] = (
        require_cross_org_probe
        and isinstance(probe, dict)
        and probe.get("witness_found") is True
        and probe.get("ok") is True
    )
    return checks


__all__ = [
    "SecurityEvaluationContext",
    "build_security_evaluation_context",
    "common_security_checks",
    "mode_security_checks",
]
