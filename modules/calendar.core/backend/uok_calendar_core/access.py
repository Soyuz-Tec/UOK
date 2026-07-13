from __future__ import annotations

from sqlalchemy import or_, true

from uok.security import Actor, has_permission

from .models import Calendar


def can_read_calendar(actor: Actor, calendar: Calendar) -> bool:
    if calendar.organization_id != actor.organization_id or calendar.status != "active":
        return False
    if has_permission(actor, "calendar.manage"):
        return True
    if calendar.owner_user_id == actor.user_id:
        return True
    return calendar.visibility_scope == "organization"


def readable_calendar_predicate(actor: Actor):
    if has_permission(actor, "calendar.manage"):
        return true()
    return or_(
        Calendar.owner_user_id == actor.user_id,
        Calendar.visibility_scope == "organization",
    )
