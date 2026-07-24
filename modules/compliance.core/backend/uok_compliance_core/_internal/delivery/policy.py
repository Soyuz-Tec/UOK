from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"compliance.read", "compliance.manage"},
        "trader": {"compliance.read", "compliance.manage"},
        "finance_manager": {"compliance.read"},
        "viewer": {"compliance.read"},
    }
