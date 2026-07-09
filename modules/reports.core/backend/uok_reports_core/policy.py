from __future__ import annotations


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"reports.render", "reports.read", "reports.manage", "reports.delete"},
        "trader": {"reports.render", "reports.read"},
        "finance_manager": {"reports.render", "reports.read"},
        "viewer": {"reports.read"},
    }
