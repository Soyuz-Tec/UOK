from __future__ import annotations

import sys
from pathlib import Path

import pytest

from uok.database_security import database_security_inventory


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
TESTS = Path(__file__).resolve().parent
for support_path in (SCRIPTS, TESTS):
    if str(support_path) not in sys.path:
        sys.path.insert(0, str(support_path))

import verify_database_security as verifier  # noqa: E402
from database_security_test_support import (  # noqa: E402
    database_security_observations,
)


@pytest.mark.parametrize(
    "attack",
    ("extra_policy", "public_role", "allow_all_or", "missing_with_check"),
)
def test_policy_gate_rejects_every_noncanonical_policy_shape(attack: str) -> None:
    observations = database_security_observations(active=False)
    policies = list(observations["policies"])
    target = next(row for row in policies if row["table_name"] == "memberships")
    if attack == "extra_policy":
        policies.append({**target, "policyname": "allow_everything"})
    elif attack == "public_role":
        target["roles"] = ["public", "uok_runtime"]
    elif attack == "allow_all_or":
        target["qual"] = f"TRUE OR ({target['qual']})"
    else:
        target["with_check"] = None
    observations["policies"] = policies

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is False
    assert report["checks"]["tenant_policy_set_is_exact"] is False


def test_gate_rejects_membership_and_privilege_escalation_drift() -> None:
    observations = database_security_observations(active=False)
    observations["role_memberships"][0]["admin_option"] = True
    observations["role_memberships"].append(
        {
            "role_name": "pg_read_all_data",
            "member_name": "uok_runtime",
            "grantor_name": "postgres",
            "admin_option": False,
            "inherit_option": True,
            "set_option": True,
        }
    )
    observations["privileges"][0]["can_references"] = True
    observations["privileges"][0]["can_trigger"] = True
    observations["sequence_privileges"][0]["can_update"] = True
    observations["default_privileges"].append(
        {
            "owner_name": "uok_owner",
            "object_type": "r",
            "grantee_name": "uok_runtime",
            "privilege_type": "TRIGGER",
            "is_grantable": False,
        }
    )

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is False
    assert report["checks"]["role_membership_graph_is_closed"] is False
    assert report["checks"]["runtime_table_privileges_are_closed"] is False
    assert report["checks"]["runtime_sequence_privileges_are_closed"] is False
    assert report["checks"]["runtime_default_privileges_are_closed"] is False


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("runtime_can_usage", False),
        ("runtime_can_create", True),
        ("public_can_usage", True),
        ("public_can_create", True),
        ("owner_name", "postgres"),
    ],
)
def test_gate_rejects_public_schema_privilege_drift(
    field: str,
    value: object,
) -> None:
    observations = database_security_observations(active=False)
    observations["schema_privileges"][0][field] = value

    report = verifier.evaluate_live_database_security(
        database_security_inventory(),
        observations,
        expect_active=False,
        runtime_login_role=None,
        migrator_login_role=None,
        require_cross_org_probe=False,
    )

    assert report["ok"] is False
    assert report["checks"]["runtime_schema_privileges_are_closed"] is False
