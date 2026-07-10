from __future__ import annotations

PLANNING_CAPABILITY_PERMISSIONS = {
    "read": "planning.read",
    "edit": "planning.edit",
    "baseline_create": "planning.baseline.create",
    "level": "planning.level",
    "link": "planning.link",
    "gate_approve": "planning.gate.approve",
    "admin": "planning.admin",
}

PLANNING_ROLE_GRANTS = {
    "ops_manager": set(PLANNING_CAPABILITY_PERMISSIONS.values()),
    "trader": {"planning.read", "planning.edit"},
    "finance_manager": {"planning.read"},
    "viewer": {"planning.read"},
}


def role_grants() -> dict[str, set[str]]:
    return {role: set(permissions) for role, permissions in PLANNING_ROLE_GRANTS.items()}


def capability_read_model(actor: object) -> dict[str, bool]:
    from uok.security import has_permission

    values = {name: has_permission(actor, permission) for name, permission in PLANNING_CAPABILITY_PERMISSIONS.items()}
    return {**values, "review_only": not values["edit"]}
