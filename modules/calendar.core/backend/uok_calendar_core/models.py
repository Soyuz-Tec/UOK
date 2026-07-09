from __future__ import annotations

from uok.models import Calendar, CalendarEvent, CalendarEventParticipant, CalendarReminder, utcnow

__all__ = [
    "Calendar",
    "CalendarEvent",
    "CalendarEventParticipant",
    "CalendarReminder",
    "owned_models",
    "utcnow",
]


def owned_models() -> dict[str, str]:
    return {
        "Calendar": Calendar.__tablename__,
        "CalendarEvent": CalendarEvent.__tablename__,
        "CalendarEventParticipant": CalendarEventParticipant.__tablename__,
        "CalendarReminder": CalendarReminder.__tablename__,
    }
