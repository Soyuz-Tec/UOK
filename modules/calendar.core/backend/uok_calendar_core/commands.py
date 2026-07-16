from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from uok.kernel_models import EventRecord
from uok.kernel.security import Actor
from uok.util import dumps, loads

from .command_contract import (
    command_permissions,
    creatable_event_status as _creatable_event_status,
    validate_event_patch_payload as _validate_event_patch_payload,
)
from .concurrency import (
    locked_event_for_update,
    require_event_precondition,
    result_with_event_etag,
)
from .event_write_support import (
    normalized_event_times,
    rezoned_all_day_times,
    reminder_minutes,
    replace_event_participants,
    replace_event_reminders,
    validate_event_time_range,
    validated_event_recurrence,
)
from .models import Calendar, CalendarEvent, CalendarReminder, utcnow
from .read_model import calendar_or_error, serialize_calendar, serialize_event, stored_utc
from .validation import (
    MAX_CALENDAR_NAME_LENGTH,
    MAX_EVENT_TEXT_LENGTH,
    MAX_EVENT_TITLE_LENGTH,
    MAX_SOURCE_FIELD_LENGTH,
    as_utc_datetime,
    bounded_text,
    object_payload,
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
        attrs_json=dumps(object_payload(payload.get("attrs", {}), "attrs")),
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
        calendar.attrs_json = dumps(object_payload(payload.get("attrs"), "attrs"))
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
    event_timezone = valid_timezone(payload.get("timezone") or calendar.timezone)
    all_day = bool(payload.get("all_day", False))
    starts_at, ends_at = normalized_event_times(starts_at, ends_at, event_timezone, all_day)
    validate_event_time_range(starts_at, ends_at)
    rule, recurrence_until = validated_event_recurrence(
        payload.get("recurrence_rule"),
        payload.get("recurrence_until"),
        starts_at,
        event_timezone,
    )
    event = CalendarEvent(
        organization_id=actor.organization_id,
        calendar_id=calendar.id,
        uid=f"{uuid4()}@uok.local",
        title=bounded_text(payload.get("title"), "title", MAX_EVENT_TITLE_LENGTH),
        description=optional_text(payload.get("description"), "description", MAX_EVENT_TEXT_LENGTH),
        location=optional_text(payload.get("location"), "location", 240),
        event_type=bounded_text(payload.get("event_type") or "event", "event_type", 40),
        status=_creatable_event_status(payload.get("status")),
        starts_at=starts_at,
        ends_at=ends_at,
        timezone=event_timezone,
        all_day=all_day,
        transparency=transparency(payload.get("transparency")),
        recurrence_rule=rule,
        recurrence_until=recurrence_until,
        source_module=optional_text(payload.get("source_module"), "source_module", MAX_SOURCE_FIELD_LENGTH),
        source_object_type=optional_text(payload.get("source_object_type"), "source_object_type", 80),
        source_object_id=optional_text(payload.get("source_object_id"), "source_object_id", 80),
        attrs_json=dumps(object_payload(payload.get("attrs", {}), "attrs")),
        created_by_user_id=actor.user_id,
    )
    if not event.title:
        raise ValueError("event title is required")
    db.add(event)
    db.flush()
    replace_event_participants(db, actor, event, payload.get("participants", []))
    replace_event_reminders(db, actor, event, payload.get("reminders", []))
    db.flush()
    _emit_event(db, actor, "CalendarEventCreated", "CalendarEvent", event.id, {"title": event.title, "calendar_id": calendar.id})
    return result_with_event_etag(db, event, serialize_event(db, event, include_detail=True))


def cmd_update_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = locked_event_for_update(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    require_event_precondition(db, event, payload)
    _validate_event_patch_payload(payload)
    stored_starts_at = stored_utc(event.starts_at)
    stored_ends_at = stored_utc(event.ends_at)
    starts_at = as_utc_datetime(payload.get("starts_at"), "starts_at") if payload.get("starts_at") else stored_starts_at
    ends_at = as_utc_datetime(payload.get("ends_at"), "ends_at") if payload.get("ends_at") else stored_ends_at
    if ends_at <= starts_at:
        raise ValueError("ends_at must be after starts_at")
    for field, limit in {"title": MAX_EVENT_TITLE_LENGTH, "description": MAX_EVENT_TEXT_LENGTH, "location": 240}.items():
        if field in payload:
            setattr(event, field, optional_text(payload.get(field), field, limit) if field != "title" else bounded_text(payload.get(field), field, limit))
    if not event.title:
        raise ValueError("event title is required")
    previous_timezone = event.timezone
    event_timezone = valid_timezone(payload.get("timezone") if "timezone" in payload else previous_timezone)
    event.timezone = event_timezone
    if "all_day" in payload:
        event.all_day = bool(payload.get("all_day"))
    if "transparency" in payload:
        event.transparency = transparency(payload.get("transparency"))
    unchanged_times = starts_at == stored_starts_at and ends_at == stored_ends_at
    if event.all_day and event_timezone != previous_timezone and unchanged_times:
        starts_at, ends_at = rezoned_all_day_times(
            stored_starts_at,
            stored_ends_at,
            previous_timezone,
            event_timezone,
        )
    else:
        starts_at, ends_at = normalized_event_times(starts_at, ends_at, event_timezone, bool(event.all_day))
    validate_event_time_range(starts_at, ends_at)
    recurrence_boundary = (
        payload.get("recurrence_until")
        if "recurrence_until" in payload
        else stored_utc(event.recurrence_until) if event.recurrence_until else None
    )
    if "recurrence_rule" in payload and not payload.get("recurrence_rule") and "recurrence_until" not in payload:
        recurrence_boundary = None
    rule, recurrence_until = validated_event_recurrence(
        payload.get("recurrence_rule") if "recurrence_rule" in payload else event.recurrence_rule,
        recurrence_boundary,
        starts_at,
        event_timezone,
    )
    event.recurrence_rule = rule
    event.recurrence_until = recurrence_until
    if "attrs" in payload:
        attrs = object_payload(loads(event.attrs_json, {}), "stored attrs")
        attrs.update(object_payload(payload.get("attrs"), "attrs"))
        event.attrs_json = dumps(attrs)
    event.starts_at = starts_at
    event.ends_at = ends_at
    if "participants" in payload:
        replace_event_participants(db, actor, event, payload.get("participants"))
    if "reminders" in payload:
        replace_event_reminders(db, actor, event, payload.get("reminders"))
    event.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "CalendarEventUpdated", "CalendarEvent", event.id, {"title": event.title})
    return result_with_event_etag(db, event, serialize_event(db, event, include_detail=True))


def cmd_cancel_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = locked_event_for_update(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    require_event_precondition(db, event, payload)
    event.status = "canceled"
    event.canceled_at = utcnow()
    event.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "CalendarEventCanceled", "CalendarEvent", event.id, {"title": event.title})
    return result_with_event_etag(db, event, serialize_event(db, event, include_detail=True))


def cmd_restore_calendar_event(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = locked_event_for_update(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    require_event_precondition(db, event, payload)
    event.status = "confirmed"
    event.canceled_at = None
    event.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "CalendarEventRestored", "CalendarEvent", event.id, {"title": event.title})
    return result_with_event_etag(db, event, serialize_event(db, event, include_detail=True))


def cmd_create_calendar_reminder(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    event = locked_event_for_update(db, actor, bounded_text(payload.get("event_id"), "event_id", 36))
    require_event_precondition(db, event, payload)
    active_count = db.scalar(select(func.count()).select_from(CalendarReminder).where(
        CalendarReminder.event_id == event.id,
        CalendarReminder.status == "active",
    )) or 0
    if int(active_count) >= 10:
        raise ValueError("an event cannot contain more than 10 active reminders")
    reminder = CalendarReminder(
        organization_id=actor.organization_id,
        event_id=event.id,
        reminder_type=reminder_type(payload.get("reminder_type")),
        trigger_minutes_before=reminder_minutes(payload.get("trigger_minutes_before")),
    )
    db.add(reminder)
    event.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "CalendarReminderCreated", "CalendarReminder", reminder.id, {"event_id": event.id})
    result = {"reminder_id": reminder.id, "event": serialize_event(db, event, include_detail=True)}
    return result_with_event_etag(db, event, result)


def cmd_delete_calendar_reminder(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    reminder = db.get(CalendarReminder, bounded_text(payload.get("reminder_id"), "reminder_id", 36))
    if not reminder or reminder.organization_id != actor.organization_id:
        raise ValueError("calendar reminder not found")
    try:
        event = locked_event_for_update(db, actor, reminder.event_id)
    except ValueError:
        raise ValueError("calendar reminder not found") from None
    require_event_precondition(db, event, payload)
    reminder.status = "deleted"
    event.updated_at = utcnow()
    db.flush()
    _emit_event(db, actor, "CalendarReminderDeleted", "CalendarReminder", reminder.id, {"event_id": reminder.event_id})
    result = {"reminder_id": reminder.id, "status": reminder.status}
    return result_with_event_etag(db, event, result)


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
