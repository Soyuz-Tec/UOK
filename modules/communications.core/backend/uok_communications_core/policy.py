from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"communications.read", "communications.edit"},
        "trader": {"communications.read", "communications.edit"},
        "finance_manager": set(),
        "viewer": {"communications.read"},
    }
