from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"shipments.read", "shipments.manage"},
        "trader": {"shipments.read", "shipments.manage"},
        "finance_manager": {"shipments.read"},
        "viewer": {"shipments.read"},
    }


__all__ = ["role_grants"]
