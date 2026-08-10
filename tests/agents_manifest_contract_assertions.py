from __future__ import annotations

from typing import Any


def assert_agents_manifest(agents: dict[str, Any]) -> None:
    assert agents["required"] is False
    assert agents["maturity"] == "integration_tested"
    assert agents["installable"] is True
    assert agents["lifecycle"] == [
        "available", "installed", "disabled", "upgraded", "uninstalled",
    ]
    assert agents["backend_path"] == "modules/agents.core/backend"
    assert agents["api_prefixes"] == ["/api/agents"]
    assert agents["api_router"] == "uok_agents_core.public_api:api_router"
    assert agents["command_handlers"] == "uok_agents_core.public_api:command_handlers"
    assert agents["command_permissions"] == "uok_agents_core.public_api:command_permissions"
    assert agents["role_grants"] == "uok_agents_core.public_api:role_grants"
    assert agents["model_exports"] == "uok_agents_core._internal.persistence.models:owned_models"
    assert set(agents["commands"]) == {
        "CreateAgentRunbook", "UpdateAgentRunbook", "ArchiveAgentRunbook",
        "StartAgentRun", "SubmitAgentPlan", "DecideAgentRun", "OverrideAgentRun",
        "CompleteAgentRun", "FailAgentRun",
    }
    assert set(agents["permissions"]) == {
        "agents.read", "agents.run", "agents.manage", "agents.approve",
        "agents.audit", "agents.override",
    }


__all__ = ["assert_agents_manifest"]
