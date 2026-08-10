from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import auth, command

from agent_test_support import (
    create_runbook,
    install_agents,
    start_run,
    submit_command_plan,
    submit_informational_plan,
    unique,
)


def test_low_risk_information_plan_can_proceed_but_recovery_command_is_regated(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_agents(client, admin)
    created = create_runbook(
        client,
        ops,
        name=unique("Low risk analysis agent"),
        risk_level="low",
        approval_policy="risk_based",
    )
    runbook = created.json()["result"]
    started = start_run(client, ops, runbook["id"]).json()["result"]

    planned = submit_informational_plan(client, ops, started["id"], started["version"])
    assert planned.status_code == 200, planned.text
    auto_approved = planned.json()["result"]
    assert auto_approved["status"] == "approved"
    assert auto_approved["approval_reason"] is None
    failed = command(client, ops, "FailAgentRun", {
        "run_id": started["id"],
        "expected_version": auto_approved["version"],
        "reason": "Deterministic dependency was unavailable",
        "failure_context": {"dependency": "catalog"},
    }, unique("agent-fail"))
    assert failed.status_code == 200, failed.text
    assert failed.json()["result"]["status"] == "failed"

    recovery = submit_command_plan(
        client,
        ops,
        started["id"],
        failed.json()["result"]["version"],
        plan_kind="recovery",
    )
    assert recovery.status_code == 200, recovery.text
    assert recovery.json()["result"]["status"] == "awaiting_approval"


def test_undeclared_tools_commands_and_scopes_fail_closed(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_agents(client, admin)
    unsupported = create_runbook(
        client,
        ops,
        name=unique("Unsupported tool agent"),
        allowed_tools=["unmanaged-tool"],
    )
    assert unsupported.status_code == 400, unsupported.text
    assert "unsupported tool bindings" in unsupported.text

    created = create_runbook(client, ops, name=unique("Scoped agent"))
    runbook = created.json()["result"]
    started = start_run(client, ops, runbook["id"]).json()["result"]
    undeclared_command = submit_command_plan(
        client,
        ops,
        started["id"],
        started["version"],
        command_name="ArchiveProductDefinition",
    )
    assert undeclared_command.status_code == 400, undeclared_command.text
    assert "undeclared command" in undeclared_command.text


def test_override_is_separate_from_approval_and_reserved_for_platform_admin(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_agents(client, admin)
    runbook = create_runbook(client, ops, name=unique("Override agent")).json()["result"]
    started = start_run(client, ops, runbook["id"]).json()["result"]
    planned = submit_command_plan(client, ops, started["id"], started["version"]).json()["result"]
    payload = {
        "run_id": started["id"],
        "expected_version": planned["version"],
        "reason": "Emergency exception approved with separate accountable evidence",
    }
    denied = command(client, ops, "OverrideAgentRun", payload, unique("agent-override-denied"))
    assert denied.status_code == 403, denied.text
    overridden = command(client, admin, "OverrideAgentRun", payload, unique("agent-override"))
    assert overridden.status_code == 200, overridden.text
    assert overridden.json()["result"]["status"] == "approved"


def test_disabled_agents_module_blocks_reads_and_commands(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_agents(client, admin)
    disabled = client.post("/api/modules/agents.core/disable", headers=admin)
    assert disabled.status_code == 200, disabled.text
    assert client.get("/api/agents/runbooks", headers=ops).status_code == 400
    blocked = create_runbook(client, ops, name=unique("Disabled agent"))
    assert blocked.status_code == 400, blocked.text
    enabled = client.post("/api/modules/agents.core/enable", headers=admin)
    assert enabled.status_code == 200, enabled.text
