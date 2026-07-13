from __future__ import annotations

import re
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import delete, update
from sqlalchemy.orm import Session

from uok.security import Actor

from .models import CalendarEvent, CalendarEventParticipant, CalendarReminder
from .recurrence import validate_recurrence_until_limit, validate_rrule
from .validation import (
    as_utc_datetime,
    optional_text,
    participant_role,
    participant_type,
    reminder_type,
    response_status,
)

MAX_REMINDER_MINUTES_BEFORE = 43200
MAX_EVENT_PARTICIPANTS = 100
MAX_EVENT_REMINDERS = 10
MAX_EVENT_DURATION = timedelta(days=366)
MIN_EVENT_INSTANT = datetime(2, 1, 1, tzinfo=timezone.utc)
MAX_EVENT_INSTANT = datetime(9998, 12, 31, 23, 59, 59, 999999, tzinfo=timezone.utc)
PARTICIPANT_EMAIL = re.compile(r'^[^@\s,:;"<>]+@[^@\s,:;"<>]+$')


def replace_event_participants(
    db: Session,
    actor: Actor,
    event: CalendarEvent,
    participants: list[dict[str, Any]],
) -> None:
    participants = _replacement_rows(participants, "participants", MAX_EVENT_PARTICIPANTS)
    db.execute(delete(CalendarEventParticipant).where(CalendarEventParticipant.event_id == event.id))
    for item in participants:
        item_type = participant_type(item.get("participant_type"))
        item_id = _safe_participant_text(item.get("participant_id"), "participant_id", 80)
        email = _safe_participant_email(item.get("email"))
        if not item_id and not email:
            raise ValueError("participant requires participant_id or email")
        db.add(CalendarEventParticipant(
            organization_id=actor.organization_id,
            event_id=event.id,
            participant_type=item_type,
            participant_id=item_id,
            email=email,
            display_name=_safe_participant_text(item.get("display_name"), "display_name", 160),
            role=participant_role(item.get("role")),
            response_status=response_status(item.get("response_status")),
        ))


def replace_event_reminders(
    db: Session,
    actor: Actor,
    event: CalendarEvent,
    reminders: list[dict[str, Any]],
) -> None:
    reminders = _replacement_rows(reminders, "reminders", MAX_EVENT_REMINDERS)
    db.execute(update(CalendarReminder).where(
        CalendarReminder.event_id == event.id,
        CalendarReminder.status == "active",
    ).values(status="deleted"))
    for item in reminders:
        db.add(CalendarReminder(
            organization_id=actor.organization_id,
            event_id=event.id,
            reminder_type=reminder_type(item.get("reminder_type")),
            trigger_minutes_before=reminder_minutes(item.get("trigger_minutes_before")),
        ))


def validated_recurrence_until(
    value: Any,
    rule: str | None,
    starts_at: datetime,
    timezone_name: str,
) -> datetime | None:
    if value is None:
        return None
    if not rule:
        raise ValueError("recurrence_until requires recurrence_rule")
    until = as_utc_datetime(value, "recurrence_until")
    _validate_operational_instant(until, "recurrence_until")
    if until < as_utc_datetime(starts_at, "starts_at"):
        raise ValueError("recurrence_until must not be before starts_at")
    validate_recurrence_until_limit(rule, starts_at, timezone_name, until)
    return until


def validate_event_time_range(starts_at: datetime, ends_at: datetime) -> None:
    start = as_utc_datetime(starts_at, "starts_at")
    end = as_utc_datetime(ends_at, "ends_at")
    _validate_operational_instant(start, "starts_at")
    _validate_operational_instant(end, "ends_at")
    if end - start > MAX_EVENT_DURATION:
        raise ValueError("event duration cannot exceed 366 days")


def validated_event_recurrence(
    rule_value: Any,
    boundary_value: Any,
    starts_at: datetime,
    timezone_name: str,
) -> tuple[str | None, datetime | None]:
    rule = validate_rrule(
        rule_value,
        starts_at,
        timezone_name,
        has_external_boundary=boundary_value is not None,
    )
    boundary = validated_recurrence_until(boundary_value, rule, starts_at, timezone_name)
    return rule, boundary


def reminder_minutes(value: Any) -> int:
    try:
        minutes = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("trigger_minutes_before must be an integer") from exc
    if minutes < 0 or minutes > MAX_REMINDER_MINUTES_BEFORE:
        raise ValueError(f"trigger_minutes_before must be between 0 and {MAX_REMINDER_MINUTES_BEFORE}")
    return minutes


def normalized_event_times(
    starts_at: datetime,
    ends_at: datetime,
    timezone_name: str,
    all_day: bool,
) -> tuple[datetime, datetime]:
    if not all_day:
        return starts_at, ends_at
    zone = ZoneInfo(timezone_name)
    local_start = starts_at.astimezone(zone)
    local_end = ends_at.astimezone(zone)
    start_date = local_start.date()
    if local_end.date() <= start_date:
        end_date = start_date + timedelta(days=1)
    elif local_end.timetz().replace(tzinfo=None) == time.min:
        end_date = local_end.date()
    else:
        end_date = local_end.date() + timedelta(days=1)
    normalized_start = datetime.combine(start_date, time.min, tzinfo=zone).astimezone(timezone.utc)
    normalized_end = datetime.combine(end_date, time.min, tzinfo=zone).astimezone(timezone.utc)
    return normalized_start, normalized_end


def rezoned_all_day_times(
    starts_at: datetime,
    ends_at: datetime,
    source_timezone: str,
    target_timezone: str,
) -> tuple[datetime, datetime]:
    source = ZoneInfo(source_timezone)
    target = ZoneInfo(target_timezone)
    start_date = starts_at.astimezone(source).date()
    day_count = max(1, (ends_at.astimezone(source).date() - start_date).days)
    normalized_start = datetime.combine(start_date, time.min, tzinfo=target).astimezone(timezone.utc)
    normalized_end = datetime.combine(start_date + timedelta(days=day_count), time.min, tzinfo=target).astimezone(timezone.utc)
    return normalized_start, normalized_end


def _replacement_rows(value: Any, field: str, limit: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError(f"{field} must be a list")
    if len(value) > limit:
        raise ValueError(f"{field} cannot contain more than {limit} items")
    if any(not isinstance(item, dict) for item in value):
        raise ValueError(f"{field} entries must be objects")
    return value


def _safe_participant_text(value: Any, field: str, limit: int) -> str | None:
    text = optional_text(value, field, limit)
    if text and any(ord(character) < 32 or ord(character) == 127 for character in text):
        raise ValueError(f"{field} cannot contain control characters")
    return text


def _safe_participant_email(value: Any) -> str | None:
    email = _safe_participant_text(value, "email", 254)
    if email and not PARTICIPANT_EMAIL.fullmatch(email):
        raise ValueError("email must be a valid participant email address")
    return email


def _validate_operational_instant(value: datetime, field: str) -> None:
    if value < MIN_EVENT_INSTANT or value > MAX_EVENT_INSTANT:
        raise ValueError(f"{field} must be between years 2 and 9998")
