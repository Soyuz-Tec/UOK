from __future__ import annotations

from uok.kernel.security import Actor, has_permission


def capability_read_model(actor: Actor) -> dict[str, bool]:
    can_read = has_permission(actor, "communications.read")
    can_edit = has_permission(actor, "communications.edit")
    return {
        "read": can_read,
        "create": can_edit,
        "delete": can_edit,
        "restore": can_edit,
    }


def role_grants() -> dict[str, set[str]]:
    return {
        "ops_manager": {"communications.read", "communications.edit"},
        "trader": {"communications.read", "communications.edit"},
        "finance_manager": set(),
        "viewer": {"communications.read"},
    }
