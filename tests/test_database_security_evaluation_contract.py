from __future__ import annotations

import sys
from pathlib import Path
from typing import cast

from uok.database_security import database_security_inventory


ROOT = Path(__file__).resolve().parents[1]
for support_path in (ROOT / "scripts", ROOT / "tests"):
    if str(support_path) not in sys.path:
        sys.path.insert(0, str(support_path))

import database_security_evaluation as evaluation  # noqa: E402
from database_security_test_support import (  # noqa: E402
    database_security_observations,
)


def test_foundation_report_preserves_exact_projection_and_order() -> None:
    inventory = database_security_inventory()
    observations = database_security_observations(active=False)

    report = evaluation.evaluate_live_database_security(
        inventory,
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert list(report) == [
        "schema",
        "ok",
        "status",
        "mode",
        "production_ready",
        "active_database_gate_ready",
        "checks",
        "counts",
        "runtime_login_role",
        "migrator_login_role",
        "cross_org_probe",
    ]
    assert list(report["checks"]) == [
        "metadata_inventory_valid",
        "database_tables_match_metadata",
        "group_roles_present",
        "group_roles_have_safe_attributes",
        "role_membership_graph_is_closed",
        "tables_owned_by_non_login_owner",
        "runtime_table_privileges_are_closed",
        "runtime_sequence_privileges_are_closed",
        "runtime_default_privileges_are_closed",
        "runtime_schema_privileges_are_closed",
        "tenant_policy_set_is_exact",
        "rls_disabled_and_unforced_for_all_tables",
    ]
    assert report["counts"] == {
        "metadata_tables": len(inventory["tables"]),
        "database_tables": len(observations["tables"]),
        "tenant_tables": len(inventory["tenant_tables"]),
        "policies": len(observations["policies"]),
        "role_memberships": len(observations["role_memberships"]),
        "sequences": len(observations["sequence_privileges"]),
        "schemas": len(observations["schema_privileges"]),
    }
    assert report["cross_org_probe"] is observations["cross_org_probe"]


def test_active_report_validates_optional_migrator_login() -> None:
    observations = database_security_observations(active=True)
    roles = cast(list[dict[str, object]], observations["roles"])
    memberships = cast(
        list[dict[str, object]],
        observations["role_memberships"],
    )
    migrator_role = {
        "rolname": "uok_migration_app",
        "rolsuper": False,
        "rolinherit": False,
        "rolcreaterole": False,
        "rolcreatedb": False,
        "rolcanlogin": True,
        "rolreplication": False,
        "rolbypassrls": False,
    }
    roles.append(migrator_role)
    memberships.append(
        {
            "role_name": "uok_migrator",
            "member_name": "uok_migration_app",
            "grantor_name": "postgres",
            "admin_option": False,
            "inherit_option": False,
            "set_option": True,
        }
    )

    report = evaluation.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role="uok_migration_app",
        require_cross_org_probe=True,
    )

    assert report["ok"] is True
    assert report["checks"]["migrator_login_is_safe_and_bounded"] is True
    assert list(report["checks"])[-2:] == [
        "migrator_login_is_safe_and_bounded",
        "cross_organization_guessed_id_probe",
    ]

    migrator_role["rolbypassrls"] = True
    rejected = evaluation.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=True,
        runtime_login_role="uok_app",
        migrator_login_role="uok_migration_app",
        require_cross_org_probe=True,
    )
    assert rejected["ok"] is False
    assert rejected["checks"]["migrator_login_is_safe_and_bounded"] is False
