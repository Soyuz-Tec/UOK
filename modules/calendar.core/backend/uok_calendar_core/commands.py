from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from uok.models import EventRecord
from uok.security import Actor
from uok.util import dumps, loads

from .models import Calendar, CalendarEvent, CalendarEventParticipant, CalendarReminder, utcnow
from .read_model import calendar_or_error, event_or_error, serialize_calendar, serialize_event
from .recurrence import validate_rrule
from .validation import (
    MAX_CALENDAR_NAME_LENGTH,
    MAX_EVENT_TEXT_LENGTH,
    MAX_EVENT_TITLE_LENGTH,
    MAX_SOURCE_FIELD_LENGTH,
    as_utc_datetime,
    bounded_text,
    event_status,
    optional_text,
    reminder_type,
    transparency,
    valid_timezone,
    visibility_scope,
)


def _emit_event(db: Session, actor: Actor, event_type: str, object_type: str, object_id: str, payload: dict[str, Any]) -> None:
    last = db.scalar(select(func.max(EventRecord.sequence)).where(EventRecord.organization_id == actor.organization_id)) or 0
    db.add(EventRecord(
        organization_id=actor.organization_id,
        sequence=int(last) + 1,
        event_type=event_type,
        object_type=object_type,
        object_id=object_id,
        payload_json=dumps(payload),
    ))


def cmd_create_calendar(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    name = bounded_text(payload.get("name"), "name", MAX_CALENDAR_NAME_LENGTH)
    if not name:
        raise ValueError("calendar name is required")
    calendar = Calendar(
        organization_id=actor.organization_id,
        owner_user_id=actor.user_id,
        name=name,
        color=optional_text(payload.get("color"), "color", 32),
        visibility_scope=visibility_scope(payload.get("visibility_scope")),
        timezone=valid_timezone(payload.get("timezone")),
        attrs_json=dumps(payload.get("attrs") or {}),
    )
    db.add(calendar)
    db.flush()
    _emit_event(db, actor, "CalendarCreated", "Calendar", calendar.id, {"name": calendar.name})
    return serialize_calendar(calendar)


def cmd_update_calendar(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    calendar = calendar_or_error(db, actor, bounded_text(payload.get("calendar_id"), "calendar_id", 36))
    if "name" in payload:
        calendar.name = bounded_text(payload.get("name"), "name", MAX_CALENDAR_NAME_LENGTH)
    if "color" in payload:
        calendar.color = optional_text(payload.get("color"), "color", 32)
    if "visibility_scope" in payload:
        calendar.visibility_scope = visibility_scope(payload.get("visibility_scope"))
    if "timezone" in payload:
        calendar.timezone = valid_timezone(payload.get("timezone"))
    if "attrs" in payload:
        calendar.attrs_json = dumps(payload.get("attrs") or {})
    calendar.updated_at = utcnow()
    _emit_event(db, actor, "CalendarUpdated", "Calendar", calendar.id, {"name": calendar.name})
    return serialize_calendar(calendar)


def cmd_delete_calendar(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    calendar = calendar_or_error(db, actor, bounded_text(payload.get("calendar_id"), "calendar_id", 36))
    calendar.status = "deleted"
    calendar.deleted_at = utcnow()
    calendar.updated_at = utcnow()
    _emit_event(db, actor, "CalendarDeleted", "Calendar", calendar.id, {"name": calendar.name})
    return serialize_calendar(calendar)


def cmd_create_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    calendar = calendar_or_error(db, actor, bounded_text(payload.get("calendar_id"), "calendar_id", 36))
    starts_at = as_utc_datetime(payload.get("starts_at"), "starts_at")
    ends_at = as_utc_datetime(payload.get("ends_at"), "ends_at")
    if ends_at <= starts_at:
        raise ValueError("ends_at must be after starts_at")
    rule = validate_rrule(payload.get("recurrence_rule"), starts_at)
    event = CalendarEvent(
        organization_id=actor.organization_id,
        calendar_id=calendar.id,
        uid=f"{uuid4()}@uok.local",
        title=bounded_text(payload.get("title"), "title", MAX_EVENT_TITLE_LENGTH),
        description=optional_text(payload.get("description"), "description", MAX_EVENT_TEXT_LENGTH),
        location=optional_text(payload.get("location"), "location", 240),
        event_type=bounded_text(payload.get("event_type") or "event", "event_type", 40),
        status=event_status(payload.get("status")),
        starts_at=starts_at,
        ends_at=ends_at,
        timezone=valid_timezone(payload.get("timezone") or calendar.timezone),
        all_day=bool(payload.get("all_day", False)),
        transparency=transparency(payload.get("transparency")),
        recurrence_rule=rule,
        recurrence_until=as_utc_datetime(payload.get("recurrence_until"), "recurrence_until") if payload.get("recurrence_until") else None,
        source_module=optional_text(payload.get("source_module"), "source_module", MAX_SOURCE_FIELD_LENGTH),
        source_object_type=optional_text(payload.get("source_object_type"), "source_object_type", 80),
        source_object_id=optional_text(payload.get("source_object_id"), "source_object_id", 80),
        attrs_json=dumps(payload.get("attrs") or {}),
        created_by_user_id=actor.user_id,
    )
    if not event.title:
        raise ValueError("event title is required")
    db.add(event)
    db.flush()
    _replace_participants(db, actor, event, payload.get("participants") or [])
    _emit_event(db, actor, "CalendarEventCreated", "CalendarEvent", event.id, {"title": event.title, "calendar_id": calendar.id})
    return serialize_event(db, event, include_detail=True)


def cmd_update_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = event_or_error(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    starts_at = as_utc_datetime(payload.get("starts_at"), "starts_at") if payload.get("starts_at") else event.starts_at
    ends_at = as_utc_datetime(payload.get("ends_at"), "ends_at") if payload.get("ends_at") else event.ends_at
    if ends_at <= starts_at:
        raise ValueError("ends_at must be after starts_at")
    for field, limit in {"title": MAX_EVENT_TITLE_LENGTH, "description": MAX_EVENT_TEXT_LENGTH, "location": 240}.items():
        if field in payload:
            setattr(event, field, optional_text(payload.get(field), field, limit) if field != "title" else bounded_text(payload.get(field), field, limit))
    if "status" in payload:
        event.status = event_status(payload.get("status"))
    if "timezone" in payload:
        event.timezone = valid_timezone(payload.get("timezone"))
    if "all_day" in payload:
        event.all_day = bool(payload.get("all_day"))
    if "transparency" in payload:
        event.transparency = transparency(payload.get("transparency"))
    if "recurrence_rule" in payload:
        event.recurrence_rule = validate_rrule(payload.get("recurrence_rule"), starts_at)
    if "recurrence_until" in payload and payload.get("recurrence_until"):
        event.recurrence_until = as_utc_datetime(payload.get("recurrence_until"), "recurrence_until")
    if "attrs" in payload:
        attrs = loads(event.attrs_json, {})
        attrs.update(payload.get("attrs") or {})
        event.attrs_json = dumps(attrs)
    event.starts_at = starts_at
    event.ends_at = ends_at
    event.updated_at = utcnow()
    _emit_event(db, actor, "CalendarEventUpdated", "CalendarEvent", event.id, {"title": event.title})
    return serialize_event(db, event, include_detail=True)


def cmd_cancel_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = event_or_error(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    event.status = "canceled"
    event.canceled_at = utcnow()
    event.updated_at = utcnow()
    _emit_event(db, actor, "CalendarEventCanceled", "CalendarEvent", event.id, {"title": event.title})
    return serialize_event(db, event, include_detail=True)


def cmd_restore_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = event_or_error(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    event.status = "confirmed"
    event.canceled_at = None
    event.updated_at = utcnow()
    _emit_event(db, actor, "CalendarEventRestored", "CalendarEvent", event.id, {"title": event.title})
    return serialize_event(db, event, include_detail=True)


def cmd_create_calendar_reminder(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = event_or_error(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    reminder = CalendarReminder(
        organization_id=actor.organization_id,
        event_id=event.id,
        reminder_type=reminder_type(payload.get("reminder_type")),
        trigger_minutes_before=int(payload.get("trigger_minutes_before")),
    )
    db.add(reminder)
    db.flush()
    _emit_event(db, actor, "CalendarReminderCreated", "CalendarReminder", reminder.id, {"event_id": event.id})
    return {"reminder_id": reminder.id, "event": serialize_event(db, event, include_detail=True)}


def cmd_delete_calendar_reminder(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    reminder = db.get(CalendarReminder, bounded_text(payload.get("reminder_id"), "reminder_id", 36))
    if not reminder or reminder.organization_id != actor.organization_id:
        raise ValueError("calendar reminder not found")
    reminder.status = "deleted"
    _emit_event(db, actor, "CalendarReminderDeleted", "CalendarReminder", reminder.id, {"event_id": reminder.event_id})
    return {"reminder_id": reminder.id, "status": reminder.status}


def _replace_participants(db: Session, actor: Actor, event: CalendarEvent, participants: list[dict[str, Any]]) -> None:
    db.execute(delete(CalendarEventParticipant).where(CalendarEventParticipant.event_id == event.id))
    for item in participants[:100]:
        db.add(CalendarEventParticipant(
            organization_id=actor.organization_id,
            event_id=event.id,
            participant_type=bounded_text(item.get("participant_type"), "participant_type", 40),
            participant_id=optional_text(item.get("participant_id"), "participant_id", 80),
            email=optional_text(item.get("email"), "email", 254),
            display_name=optional_text(item.get("display_name"), "display_name", 160),
            role=bounded_text(item.get("role") or "required", "role", 40),
            response_status=bounded_text(item.get("response_status") or "needs_action", "response_status", 40),
        ))


def command_handlers():
    return {
        "CreateCalendar": cmd_create_calendar,
        "UpdateCalendar": cmd_update_calendar,
        "DeleteCalendar": cmd_delete_calendar,
        "CreateCalendarEvent": cmd_create_calendar_event,
        "UpdateCalendarEvent": cmd_update_calendar_event,
        "CancelCalendarEvent": cmd_cancel_calendar_event,
        "RestoreCalendarEvent": cmd_restore_calendar_event,
        "CreateCalendarReminder": cmd_create_calendar_reminder,
        "DeleteCalendarReminder": cmd_delete_calendar_reminder,
    }


def command_permissions() -> dict[str, str]:
    return {
        "CreateCalendar": "calendar.manage",
        "UpdateCalendar": "calendar.manage",
        "DeleteCalendar": "calendar.manage",
        "CreateCalendarEvent": "calendar.event.create",
        "UpdateCalendarEvent": "calendar.event.update",
        "CancelCalendarEvent": "calendar.event.cancel",
        "RestoreCalendarEvent": "calendar.event.restore",
        "CreateCalendarReminder": "calendar.reminder.manage",
        "DeleteCalendarReminder": "calendar.reminder.manage",
    }
