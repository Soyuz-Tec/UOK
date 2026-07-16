from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import loads

from .access import can_read_calendar, readable_calendar_predicate
from .calendar_lifecycle import calendar_lifecycle_capabilities, strong_calendar_etag
from .models import Calendar, CalendarEvent, CalendarEventParticipant, CalendarReminder
from .occurrence_support import event_occurrence_ranges


def stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def iso_or_none(value: Any) -> str | None:
    if isinstance(value, datetime):
        return stored_utc(value).isoformat()
    return value.isoformat() if hasattr(value, "isoformat") else None


def serialize_calendar(calendar: Calendar, actor: Actor | None = None) -> dict[str, Any]:
    data = {
        "id": calendar.id,
        "name": calendar.name,
        "color": calendar.color,
        "visibility_scope": calendar.visibility_scope,
        "timezone": calendar.timezone,
        "status": calendar.status,
        "attrs": loads(calendar.attrs_json, {}),
        "created_at": iso_or_none(calendar.created_at),
        "updated_at": iso_or_none(calendar.updated_at),
        "etag": strong_calendar_etag(calendar),
    }
    if actor is not None:
        data.update(calendar_lifecycle_capabilities(actor, calendar))
    return data


def serialize_event(db: Session, event: CalendarEvent, include_detail: bool = False) -> dict[str, Any]:
    data = {
        "id": event.id,
        "calendar_id": event.calendar_id,
        "uid": event.uid,
        "title": event.title,
        "description": event.description,
        "location": event.location,
        "event_type": event.event_type,
        "status": event.status,
        "starts_at": stored_utc(event.starts_at).isoformat(),
        "ends_at": stored_utc(event.ends_at).isoformat(),
        "timezone": event.timezone,
        "all_day": event.all_day,
        "transparency": event.transparency,
        "recurrence_rule": event.recurrence_rule,
        "recurrence_until": iso_or_none(event.recurrence_until),
        "source_module": event.source_module,
        "source_object_type": event.source_object_type,
        "source_object_id": event.source_object_id,
        "attrs": loads(event.attrs_json, {}),
        "created_at": iso_or_none(event.created_at),
        "updated_at": iso_or_none(event.updated_at),
        "canceled_at": iso_or_none(event.canceled_at),
    }
    if include_detail:
        data["participants"] = participant_rows(db, event.id)
        data["reminders"] = reminder_rows(db, event.id)
    return data


def list_calendars(db: Session, actor: Actor, include_deleted: bool = False) -> list[dict[str, Any]]:
    query = select(Calendar).where(
        Calendar.organization_id == actor.organization_id,
        readable_calendar_predicate(actor),
    )
    query = query.where(
        Calendar.status.in_(("active", "deleted"))
        if include_deleted
        else Calendar.status == "active"
    )
    return [serialize_calendar(row, actor) for row in db.scalars(query.order_by(Calendar.name)).all()]


def calendar_or_error(db: Session, actor: Actor, calendar_id: str) -> Calendar:
    row = db.get(Calendar, calendar_id)
    if not row or not can_read_calendar(actor, row):
        raise ValueError("calendar not found")
    return row


def event_or_error(db: Session, actor: Actor, event_id: str) -> CalendarEvent:
    row = db.get(CalendarEvent, event_id)
    if not row or row.organization_id != actor.organization_id:
        raise ValueError("calendar event not found")
    calendar = db.get(Calendar, row.calendar_id)
    if not calendar or not can_read_calendar(actor, calendar):
        raise ValueError("calendar event not found")
    return row


def event_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None, include_canceled: bool = False) -> list[CalendarEvent]:
    query = select(CalendarEvent).join(Calendar, Calendar.id == CalendarEvent.calendar_id).where(
        CalendarEvent.organization_id == actor.organization_id,
        Calendar.organization_id == actor.organization_id,
        Calendar.status == "active",
        readable_calendar_predicate(actor),
    )
    if calendar_id:
        query = query.where(CalendarEvent.calendar_id == calendar_id)
    if not include_canceled:
        query = query.where(CalendarEvent.status != "canceled")
    overlaps = and_(CalendarEvent.ends_at > start, CalendarEvent.starts_at < end)
    # recurrence_until stores an occurrence start. The last occurrence can start
    # before this window and still overlap it, so duration-aware expansion owns
    # the end-boundary check rather than this database prefilter.
    recurring = and_(CalendarEvent.recurrence_rule.is_not(None), CalendarEvent.starts_at < end)
    return list(db.scalars(query.where(or_(overlaps, recurring)).order_by(CalendarEvent.starts_at)).all())


def occurrence_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None, include_canceled: bool = False) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for event in event_rows(db, actor, start, end, calendar_id, include_canceled):
        for occurrence_start, occurrence_end in event_occurrence_ranges(event, start, end):
            item = serialize_event(db, event)
            item["occurrence_start"] = occurrence_start.isoformat()
            item["occurrence_end"] = occurrence_end.isoformat()
            rows.append(item)
    return sorted(rows, key=lambda item: item["occurrence_start"])


def freebusy_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None) -> list[dict[str, str]]:
    return [
        {"start": row["occurrence_start"], "end": row["occurrence_end"]}
        for row in occurrence_rows(db, actor, start, end, calendar_id)
        if row["transparency"] == "busy"
    ]


def occurrence_rows_for_participants(
    db: Session,
    actor: Actor,
    start: datetime,
    end: datetime,
    participant_ids: set[str],
) -> list[dict[str, Any]]:
    if not participant_ids:
        return []
    rows = db.execute(select(
        CalendarEventParticipant.event_id,
        CalendarEventParticipant.participant_id,
    ).where(
        CalendarEventParticipant.organization_id == actor.organization_id,
        CalendarEventParticipant.participant_type == "party",
        CalendarEventParticipant.participant_id.in_(participant_ids),
    )).all()
    parties_by_event: dict[str, set[str]] = {}
    for event_id, participant_id in rows:
        if participant_id:
            parties_by_event.setdefault(str(event_id), set()).add(str(participant_id))
    return [
        {**row, "participant_ids": sorted(parties_by_event[str(row["id"])])}
        for row in occurrence_rows(db, actor, start, end)
        if str(row["id"]) in parties_by_event
    ]


def freebusy_rows_for_participants(
    db: Session,
    actor: Actor,
    start: datetime,
    end: datetime,
    participant_ids: set[str],
) -> list[dict[str, Any]]:
    return [
        {
            "event_id": row["id"],
            "start": row["occurrence_start"],
            "end": row["occurrence_end"],
            "title": row["title"],
            "participant_ids": row["participant_ids"],
        }
        for row in occurrence_rows_for_participants(db, actor, start, end, participant_ids)
        if row["transparency"] == "busy"
    ]


def participant_rows(db: Session, event_id: str) -> list[dict[str, Any]]:
    query = select(CalendarEventParticipant).where(CalendarEventParticipant.event_id == event_id).order_by(CalendarEventParticipant.id)
    return [
        {
            "id": row.id,
            "participant_type": row.participant_type,
            "participant_id": row.participant_id,
            "email": row.email,
            "display_name": row.display_name,
            "role": row.role,
            "response_status": row.response_status,
        }
        for row in db.scalars(query).all()
    ]


def reminder_rows(db: Session, event_id: str) -> list[dict[str, Any]]:
    query = select(CalendarReminder).where(
        CalendarReminder.event_id == event_id,
        CalendarReminder.status == "active",
    ).order_by(CalendarReminder.id)
    return [{"id": row.id, "reminder_type": row.reminder_type, "trigger_minutes_before": row.trigger_minutes_before} for row in db.scalars(query).all()]
