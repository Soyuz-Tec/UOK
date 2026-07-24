from __future__ import annotations

import re
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import (
    COMMAND_ETAG_RESULT_KEY,
    COMMAND_IF_MATCH_CONTEXT_KEY,
    CommandPreconditionError,
)
from uok.kernel.security import Actor
from uok.util import dumps

from .access import can_read_calendar
from .models import Calendar, CalendarEvent, CalendarReminder
from .read_model import serialize_event, stored_utc

STRONG_EVENT_ETAG = re.compile(r'^"calendar-event-sha256-[a-f0-9]{64}"$')


def locked_active_calendar_for_write(
    db: Session,
    actor: Actor,
    calendar_id: str,
    *,
    not_found: str = "calendar not found",
) -> Calendar:
    calendar = db.scalar(
        select(Calendar)
        .where(
            Calendar.id == calendar_id,
            Calendar.organization_id == actor.organization_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not calendar or not can_read_calendar(actor, calendar):
        raise ValueError(not_found)
    return calendar


def locked_event_for_update(db: Session, actor: Actor, event_id: str) -> CalendarEvent:
    calendar_id = db.scalar(
        select(CalendarEvent.calendar_id).where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == actor.organization_id,
        )
    )
    if not calendar_id:
        raise ValueError("calendar event not found")
    calendar = locked_active_calendar_for_write(
        db,
        actor,
        str(calendar_id),
        not_found="calendar event not found",
    )
    event = db.scalar(
        select(CalendarEvent)
        .where(
            CalendarEvent.id == event_id,
            CalendarEvent.organization_id == actor.organization_id,
            CalendarEvent.calendar_id == calendar.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not event:
        raise ValueError("calendar event not found")
    return event


def locked_event_and_reminder_for_update(
    db: Session,
    actor: Actor,
    reminder_id: str,
) -> tuple[CalendarEvent, CalendarReminder]:
    event_id = db.scalar(
        select(CalendarReminder.event_id).where(
            CalendarReminder.id == reminder_id,
            CalendarReminder.organization_id == actor.organization_id,
        )
    )
    if not event_id:
        raise ValueError("calendar reminder not found")
    try:
        event = locked_event_for_update(db, actor, str(event_id))
    except ValueError:
        raise ValueError("calendar reminder not found") from None
    reminder = db.scalar(
        select(CalendarReminder)
        .where(
            CalendarReminder.id == reminder_id,
            CalendarReminder.organization_id == actor.organization_id,
            CalendarReminder.event_id == event.id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not reminder:
        raise ValueError("calendar reminder not found")
    return event, reminder


def strong_event_etag(db: Session, event: CalendarEvent) -> str:
    snapshot = serialize_event(db, event, include_detail=True)
    digest = sha256(dumps(snapshot).encode("utf-8")).hexdigest()
    return f'"calendar-event-sha256-{digest}"'


def require_event_precondition(db: Session, event: CalendarEvent, payload: dict[str, Any]) -> None:
    supplied = payload.get(COMMAND_IF_MATCH_CONTEXT_KEY)
    current_etag = strong_event_etag(db, event)
    updated_at = stored_utc(event.updated_at or event.created_at)
    common = {
        "current_revision": max(1, int(updated_at.timestamp() * 1_000_000)),
        "current_etag": current_etag,
        "object_ids": [event.id],
        "reload_url": f"/api/calendar/events/{event.id}",
    }
    if supplied is None or not str(supplied).strip():
        raise CommandPreconditionError(
            code="precondition_required",
            message="A current strong Calendar event ETag is required for this update.",
            status_code=428,
            repair="Reload the event, review the latest participants and reminders, then retry with its exact ETag.",
            **common,
        )
    if not STRONG_EVENT_ETAG.fullmatch(str(supplied)):
        raise CommandPreconditionError(
            code="invalid_precondition",
            message="If-Match must contain exactly one quoted strong Calendar event ETag.",
            status_code=400,
            repair="Use the exact ETag returned by the latest event-detail response.",
            **common,
        )
    if str(supplied) != current_etag:
        raise CommandPreconditionError(
            code="stale_precondition",
            message="The Calendar event changed after it was loaded.",
            status_code=412,
            repair="Reload the event and explicitly reapply or discard the intended changes.",
            **common,
        )


def result_with_event_etag(db: Session, event: CalendarEvent, result: dict[str, Any]) -> dict[str, Any]:
    return {**result, COMMAND_ETAG_RESULT_KEY: strong_event_etag(db, event)}
