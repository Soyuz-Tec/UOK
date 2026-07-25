from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from database_security_acl import READ_ONLY_TABLES as READ_ONLY_TABLES
from database_security_evaluation_checks import (
    SecurityEvaluationContext,
    build_security_evaluation_context,
    common_security_checks,
    mode_security_checks,
)


def evaluate_live_database_security(
    inventory: dict[str, Any],
    observations: dict[str, Any],
    *,
    expect_active: bool,
    runtime_login_role: str | None,
    migrator_login_role: str | None,
    require_cross_org_probe: bool,
) -> dict[str, Any]:
    context = build_security_evaluation_context(inventory, observations)
    checks = common_security_checks(
        inventory,
        observations,
        context,
        runtime_login_role=runtime_login_role,
        migrator_login_role=migrator_login_role,
    )
    checks.update(
        mode_security_checks(
            observations,
            context,
            expect_active=expect_active,
            runtime_login_role=runtime_login_role,
            migrator_login_role=migrator_login_role,
            require_cross_org_probe=require_cross_org_probe,
        )
    )
    return _build_security_report(
        inventory,
        observations,
        context,
        checks,
        expect_active=expect_active,
        runtime_login_role=runtime_login_role,
        migrator_login_role=migrator_login_role,
        require_cross_org_probe=require_cross_org_probe,
    )


def _build_security_report(
    inventory: Mapping[str, Any],
    observations: Mapping[str, Any],
    context: SecurityEvaluationContext,
    checks: dict[str, bool],
    *,
    expect_active: bool,
    runtime_login_role: str | None,
    migrator_login_role: str | None,
    require_cross_org_probe: bool,
) -> dict[str, Any]:
    ok = all(checks.values())
    return {
        "schema": inventory["schema"],
        "ok": ok,
        "status": "pass" if ok else "fail",
        "mode": "active" if expect_active else "foundation",
        "production_ready": False,
        "active_database_gate_ready": bool(
            expect_active and require_cross_org_probe and ok
        ),
        "checks": checks,
        "counts": {
            "metadata_tables": len(context.expected_tables),
            "database_tables": len(context.live_tables),
            "tenant_tables": len(context.tenant_tables),
            "policies": len(observations["policies"]),
            "role_memberships": len(observations["role_memberships"]),
            "sequences": len(observations["sequence_privileges"]),
            "schemas": len(observations["schema_privileges"]),
        },
        "runtime_login_role": runtime_login_role,
        "migrator_login_role": migrator_login_role,
        "cross_org_probe": observations["cross_org_probe"],
    }


__all__ = [
    "READ_ONLY_TABLES",
    "evaluate_live_database_security",
]
