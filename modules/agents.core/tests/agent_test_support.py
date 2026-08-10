from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import command


def unique(prefix: str) -> str:
    return f"{prefix}-{uuid4().hex[:10]}"


def install_agents(client: TestClient, admin: dict[str, str]) -> None:
    for module_name in ("product.master", "agents.core"):
        response = client.post(f"/api/modules/{module_name}/install", headers=admin)
        assert response.status_code == 200, response.text


def create_runbook(
    client: TestClient,
    headers: dict[str, str],
    *,
    name: str,
    risk_level: str = "high",
    approval_policy: str = "risk_based",
    allowed_tools: list[str] | None = None,
    allowed_commands: list[str] | None = None,
    allowed_data_scopes: list[str] | None = None,
):
    return command(client, headers, "CreateAgentRunbook", {
        "name": name,
        "description": "Governed Product Master operations",
        "goal": "Analyze Product Master intent and prepare a bounded proposal",
        "target_module": "product.master",
        "allowed_tools": allowed_tools if allowed_tools is not None else ["codex"],
        "allowed_commands": allowed_commands if allowed_commands is not None else ["CreateProductDefinition"],
        "allowed_data_scopes": (
            allowed_data_scopes if allowed_data_scopes is not None else ["products.read", "products.manage"]
        ),
        "risk_level": risk_level,
        "approval_policy": approval_policy,
    }, unique("agent-runbook-create"))


def start_run(client: TestClient, headers: dict[str, str], runbook_id: str):
    return command(client, headers, "StartAgentRun", {
        "runbook_id": runbook_id,
        "input_context": {"request": "Prepare one governed Product Definition proposal"},
    }, unique("agent-run-start"))


def submit_command_plan(
    client: TestClient,
    headers: dict[str, str],
    run_id: str,
    version: int,
    *,
    plan_kind: str = "initial",
    command_name: str = "CreateProductDefinition",
):
    return command(client, headers, "SubmitAgentPlan", {
        "run_id": run_id,
        "expected_version": version,
        "plan_kind": plan_kind,
        "summary": "Analyze the request, then propose one bounded Product Master command",
        "steps": [
            {
                "step_id": "analyze",
                "kind": "tool",
                "title": "Analyze supplied intent",
                "instructions": "Use the governed Codex binding to draft a normalized proposal.",
                "impact": "informational",
                "target_module": "product.master",
                "tool": "codex",
                "data_scopes": ["products.read"],
            },
            {
                "step_id": "propose-command",
                "kind": "command",
                "title": "Propose the Product Master command",
                "instructions": "Prepare the command payload but do not execute it directly.",
                "impact": "internal_update",
                "target_module": "product.master",
                "command": command_name,
                "data_scopes": ["products.manage"],
                "depends_on": ["analyze"],
            },
        ],
    }, unique("agent-plan-submit"))


def submit_informational_plan(
    client: TestClient,
    headers: dict[str, str],
    run_id: str,
    version: int,
):
    return command(client, headers, "SubmitAgentPlan", {
        "run_id": run_id,
        "expected_version": version,
        "plan_kind": "initial",
        "summary": "Summarize the request without mutating business state",
        "steps": [{
            "step_id": "summarize",
            "kind": "tool",
            "title": "Summarize supplied intent",
            "instructions": "Use Codex only to prepare a human-readable summary.",
            "impact": "informational",
            "target_module": "product.master",
            "tool": "codex",
            "data_scopes": ["products.read"],
        }],
    }, unique("agent-plan-informational"))


__all__ = [
    "create_runbook",
    "install_agents",
    "start_run",
    "submit_command_plan",
    "submit_informational_plan",
    "unique",
]
