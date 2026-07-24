from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"locations.read", "locations.manage"},
        "trader": {"locations.read", "locations.manage"},
        "finance_manager": {"locations.read"},
        "viewer": {"locations.read"},
    }
