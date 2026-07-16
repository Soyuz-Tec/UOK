from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor, has_permission

from .models import CalendarEvent as _CalendarEvent
from .read_model import freebusy_rows_for_participants, occurrence_rows_for_participants

ReferenceStatus = Literal["ready", "unavailable", "denied", "missing"]


@dataclass(frozen=True)
class CalendarEventReferenceResolution:
    status: ReferenceStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_calendar_event_reference(
    db: Session,
    actor: Actor,
    event_id: str,
) -> CalendarEventReferenceResolution:
    """Resolve an event reference without exposing the Calendar ORM mapping."""
    if not has_permission(actor, "calendar.read"):
        return CalendarEventReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    row = db.scalar(select(_CalendarEvent).where(
        _CalendarEvent.id == event_id,
        _CalendarEvent.organization_id == actor.organization_id,
    ))
    if row is None:
        return CalendarEventReferenceResolution(
            "missing",
            None,
            "The calendar event target does not exist in this organization.",
        )
    if row.canceled_at is not None or row.status == "canceled":
        return CalendarEventReferenceResolution("unavailable", row.title, "Calendar event is canceled.")
    return CalendarEventReferenceResolution(
        "ready",
        row.title,
        f"Calendar event is {row.status}.",
        f"/?view=calendar&event_id={row.id}",
    )


__all__ = [
    "CalendarEventReferenceResolution",
    "freebusy_rows_for_participants",
    "occurrence_rows_for_participants",
    "resolve_calendar_event_reference",
]
