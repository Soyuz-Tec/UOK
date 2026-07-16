from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from uok.security import Actor

from .calendar_lifecycle import (
    locked_user_managed_calendar,
    require_calendar_precondition,
    result_with_calendar_etag,
)
from .command_events import emit_calendar_event
from .models import utcnow
from .read_model import serialize_calendar
from .validation import bounded_text


def cmd_delete_calendar(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    calendar = locked_user_managed_calendar(
        db,
        actor,
        bounded_text(payload.get("calendar_id"), "calendar_id", 36),
    )
    require_calendar_precondition(calendar, payload, "delete")
    if calendar.status == "deleted":
        return result_with_calendar_etag(
            calendar,
            serialize_calendar(calendar, actor),
        )
    if calendar.status != "active":
        raise ValueError("calendar has an invalid lifecycle state and cannot be deleted")
    calendar.status = "deleted"
    calendar.deleted_at = utcnow()
    calendar.updated_at = utcnow()
    emit_calendar_event(
        db,
        actor,
        "CalendarDeleted",
        "Calendar",
        calendar.id,
        {"name": calendar.name},
    )
    return result_with_calendar_etag(
        calendar,
        serialize_calendar(calendar, actor),
    )


def cmd_restore_calendar(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    calendar = locked_user_managed_calendar(
        db,
        actor,
        bounded_text(payload.get("calendar_id"), "calendar_id", 36),
    )
    require_calendar_precondition(calendar, payload, "restore")
    if calendar.status == "active":
        return result_with_calendar_etag(
            calendar,
            serialize_calendar(calendar, actor),
        )
    if calendar.status != "deleted":
        raise ValueError("calendar has an invalid lifecycle state and cannot be restored")
    calendar.status = "active"
    calendar.deleted_at = None
    calendar.updated_at = utcnow()
    emit_calendar_event(
        db,
        actor,
        "CalendarRestored",
        "Calendar",
        calendar.id,
        {"name": calendar.name},
    )
    return result_with_calendar_etag(
        calendar,
        serialize_calendar(calendar, actor),
    )
