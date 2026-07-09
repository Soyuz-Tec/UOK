from __future__ import annotations

PLANNING_ROLE_GRANTS = {
    "ops_manager": {"planning.read", "planning.manage"},
    "trader": {"planning.read"},
    "finance_manager": {"planning.read"},
    "viewer": {"planning.read"},
}


def role_grants() -> dict[str, set[str]]:
    return {role: set(permissions) for role, permissions in PLANNING_ROLE_GRANTS.items()}
