from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"routes.read", "routes.manage"},
        "trader": {"routes.read", "routes.manage"},
        "finance_manager": {"routes.read"},
        "viewer": {"routes.read"},
    }
