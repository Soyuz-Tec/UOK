from __future__ import annotations

from uok.security import Actor, has_permission


CALENDAR_CAPABILITY_PERMISSIONS = {
    "read": "calendar.read",
    "manage": "calendar.manage",
    "create": "calendar.manage",
    "delete": "calendar.manage",
    "restore": "calendar.manage",
}


def role_grants() -> dict[str, set[str]]:
    manager = {
        "calendar.read",
        "calendar.manage",
        "calendar.event.create",
        "calendar.event.update",
        "calendar.event.cancel",
        "calendar.event.restore",
        "calendar.freebusy.read",
        "calendar.reminder.manage",
        "calendar.ics.export",
    }
    contributor = {
        "calendar.read",
        "calendar.event.create",
        "calendar.event.update",
        "calendar.event.cancel",
        "calendar.freebusy.read",
        "calendar.reminder.manage",
        "calendar.ics.export",
    }
    reader = {"calendar.read", "calendar.freebusy.read", "calendar.ics.export"}
    return {
        "ops_manager": manager,
        "trader": contributor,
        "finance_manager": contributor,
        "viewer": reader,
    }


def capability_read_model(actor: Actor) -> dict[str, bool]:
    return {
        name: has_permission(actor, permission)
        for name, permission in CALENDAR_CAPABILITY_PERMISSIONS.items()
    }
