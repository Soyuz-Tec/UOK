from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import loads

from .models import Calendar, CalendarEvent, CalendarEventParticipant, CalendarReminder
from .recurrence import expanded_starts


def iso_or_none(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def serialize_calendar(calendar: Calendar) -> dict[str, Any]:
    return {
        "id": calendar.id,
        "name": calendar.name,
        "color": calendar.color,
        "visibility_scope": calendar.visibility_scope,
        "timezone": calendar.timezone,
        "status": calendar.status,
        "attrs": loads(calendar.attrs_json, {}),
        "created_at": iso_or_none(calendar.created_at),
        "updated_at": iso_or_none(calendar.updated_at),
    }


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
        "starts_at": event.starts_at.isoformat(),
        "ends_at": event.ends_at.isoformat(),
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
    query = select(Calendar).where(Calendar.organization_id == actor.organization_id)
    if not include_deleted:
        query = query.where(Calendar.status != "deleted")
    return [serialize_calendar(row) for row in db.scalars(query.order_by(Calendar.name)).all()]


def calendar_or_error(db: Session, actor: Actor, calendar_id: str) -> Calendar:
    row = db.get(Calendar, calendar_id)
    if not row or row.organization_id != actor.organization_id or row.status == "deleted":
        raise ValueError("calendar not found")
    return row


def event_or_error(db: Session, actor: Actor, event_id: str) -> CalendarEvent:
    row = db.get(CalendarEvent, event_id)
    if not row or row.organization_id != actor.organization_id:
        raise ValueError("calendar event not found")
    return row


def event_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None, include_canceled: bool = False) -> list[CalendarEvent]:
    query = select(CalendarEvent).where(CalendarEvent.organization_id == actor.organization_id)
    if calendar_id:
        query = query.where(CalendarEvent.calendar_id == calendar_id)
    if not include_canceled:
        query = query.where(CalendarEvent.status != "canceled")
    overlaps = and_(CalendarEvent.ends_at > start, CalendarEvent.starts_at < end)
    recurring = and_(CalendarEvent.recurrence_rule.is_not(None), CalendarEvent.starts_at < end, or_(CalendarEvent.recurrence_until.is_(None), CalendarEvent.recurrence_until >= start))
    return list(db.scalars(query.where(or_(overlaps, recurring)).order_by(CalendarEvent.starts_at)).all())


def occurrence_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None, include_canceled: bool = False) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for event in event_rows(db, actor, start, end, calendar_id, include_canceled):
        duration = event.ends_at - event.starts_at
        window_start = start - duration
        for occurrence_start in expanded_starts(event.recurrence_rule, event.starts_at, window_start, end):
            occurrence_end = occurrence_start + duration
            if occurrence_start < end and occurrence_end > start:
                item = serialize_event(db, event)
                item["occurrence_start"] = occurrence_start.isoformat()
                item["occurrence_end"] = occurrence_end.isoformat()
                rows.append(item)
    return sorted(rows, key=lambda item: item["occurrence_start"])


def freebusy_rows(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None) -> list[dict[str, str]]:
    return [
        {"event_id": row["id"], "start": row["occurrence_start"], "end": row["occurrence_end"], "title": row["title"]}
        for row in occurrence_rows(db, actor, start, end, calendar_id)
        if row["transparency"] == "busy"
    ]


def participant_rows(db: Session, event_id: str) -> list[dict[str, Any]]:
    query = select(CalendarEventParticipant).where(CalendarEventParticipant.event_id == event_id)
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
    query = select(CalendarReminder).where(CalendarReminder.event_id == event_id, CalendarReminder.status == "active")
    return [{"id": row.id, "reminder_type": row.reminder_type, "trigger_minutes_before": row.trigger_minutes_before} for row in db.scalars(query).all()]
