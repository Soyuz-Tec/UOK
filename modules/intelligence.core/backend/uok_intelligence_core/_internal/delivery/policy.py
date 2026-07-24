from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"intelligence.read"},
        "trader": {"intelligence.read"},
        "finance_manager": {"intelligence.read"},
        "viewer": {"intelligence.read"},
    }


__all__ = ["role_grants"]
