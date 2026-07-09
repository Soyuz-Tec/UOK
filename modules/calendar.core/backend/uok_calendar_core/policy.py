from __future__ import annotations


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
