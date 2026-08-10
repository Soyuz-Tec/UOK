from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"agents.read", "agents.run", "agents.manage", "agents.approve", "agents.audit"},
        "trader": {"agents.read", "agents.run"},
        "finance_manager": {"agents.read", "agents.audit"},
        "viewer": {"agents.read"},
    }


__all__ = ["role_grants"]
