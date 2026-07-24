from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"products.read", "products.manage"},
        "trader": {"products.read", "products.manage"},
        "finance_manager": {"products.read"},
        "viewer": {"products.read"},
    }
