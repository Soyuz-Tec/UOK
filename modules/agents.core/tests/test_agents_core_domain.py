from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_agents_core._internal.delivery.plan_policy import validate_plan
from uok_agents_core._internal.delivery.request_schemas import AgentPlanSubmitRequest, AgentRunbookCreateRequest
from uok_agents_core._internal.persistence.models import AgentApproval, AgentEvidence, AgentRun, AgentRunbook, owned_models
from uok_agents_core.public_api import __all__ as public_symbols


def test_runbook_contract_normalizes_guardrails_and_forbids_extra_fields() -> None:
    request = AgentRunbookCreateRequest(
        name="  Product proposal agent  ",
        goal="  Prepare a bounded proposal  ",
        target_module="product.master",
        allowed_tools=["codex"],
        allowed_commands=["CreateProductDefinition"],
        allowed_data_scopes=["products.read"],
    )

    assert request.name == "Product proposal agent"
    assert request.goal == "Prepare a bounded proposal"
    with pytest.raises(ValidationError):
        AgentRunbookCreateRequest.model_validate({
            **request.model_dump(),
            "unexpected": True,
        })


@pytest.mark.parametrize(
    "field,value",
    [
        ("allowed_tools", ["codex", "codex"]),
        ("allowed_commands", ["not-a-command"]),
        ("allowed_data_scopes", ["Products Read"]),
    ],
)
def test_runbook_contract_rejects_ambiguous_guardrails(field: str, value: list[str]) -> None:
    payload = {
        "name": "Agent",
        "goal": "Prepare a proposal",
        "target_module": "product.master",
        "allowed_tools": ["codex"],
        "allowed_commands": [],
        "allowed_data_scopes": [],
        field: value,
    }
    with pytest.raises(ValidationError):
        AgentRunbookCreateRequest.model_validate(payload)


def test_generated_plan_requires_a_dag_and_declared_scope() -> None:
    run = SimpleNamespace(
        status="draft",
        target_module="product.master",
        allowed_tools_json='["codex"]',
        allowed_commands_json='["CreateProductDefinition"]',
        allowed_data_scopes_json='["products.read"]',
        approval_policy="risk_based",
        risk_level="low",
    )
    cyclic = AgentPlanSubmitRequest.model_validate({
        "run_id": "run-1",
        "expected_version": 1,
        "summary": "Cyclic plan",
        "steps": [
            {"step_id": "a", "kind": "analysis", "title": "A", "instructions": "A", "depends_on": ["b"]},
            {"step_id": "b", "kind": "analysis", "title": "B", "instructions": "B", "depends_on": ["a"]},
        ],
    })
    with pytest.raises(ValueError, match="contains a cycle"):
        validate_plan(run, cyclic)

    undeclared_scope = cyclic.model_copy(update={
        "steps": [cyclic.steps[0].model_copy(update={"depends_on": [], "data_scopes": ["products.manage"]})],
    })
    with pytest.raises(ValueError, match="undeclared data scopes"):
        validate_plan(run, undeclared_scope)


def test_agents_manifest_models_migration_and_public_facade_match() -> None:
    manifest = load_module_manifests()["agents.core"]
    root = Path(__file__).parents[1]
    migration = (root / "migrations" / "001_agents_core.sql").read_text(encoding="utf-8")

    assert manifest["maturity"] == "integration_tested"
    assert manifest["api_router"] == "uok_agents_core.public_api:api_router"
    assert set(manifest["permissions"]) == {
        "agents.read", "agents.run", "agents.manage", "agents.approve", "agents.audit", "agents.override"
    }
    assert owned_models() == {
        "AgentRunbook": AgentRunbook,
        "AgentRun": AgentRun,
        "AgentApproval": AgentApproval,
        "AgentEvidence": AgentEvidence,
    }
    assert public_symbols == ["api_router", "command_handlers", "command_permissions", "role_grants"]
    for table in ("agent_runbooks", "agent_runs", "agent_approvals", "agent_evidence"):
        assert f"CREATE TABLE IF NOT EXISTS {table}" in migration
