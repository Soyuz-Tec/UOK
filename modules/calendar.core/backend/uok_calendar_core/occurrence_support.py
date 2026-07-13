from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from typing import Iterator
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from .models import CalendarEvent
from .recurrence import expanded_starts

UTC_MIN = datetime.min.replace(tzinfo=timezone.utc)
UTC_MAX = datetime.max.replace(tzinfo=timezone.utc)


def event_occurrence_ranges(
    event: CalendarEvent,
    window_start: datetime,
    window_end: datetime,
) -> Iterator[tuple[datetime, datetime]]:
    event_start = _stored_utc(event.starts_at)
    event_end = _stored_utc(event.ends_at)
    duration = _event_expansion_duration(event, event_start, event_end)
    candidate_start = _safe_subtract(_stored_utc(window_start), duration)
    for occurrence_start in expanded_starts(
        event.recurrence_rule,
        event_start,
        candidate_start,
        _stored_utc(window_end),
        timezone_name=event.timezone,
        recurrence_until=_stored_utc(event.recurrence_until) if event.recurrence_until else None,
    ):
        occurrence_end = _occurrence_end(event, occurrence_start, duration)
        if occurrence_start < window_end and occurrence_end > window_start:
            yield occurrence_start, occurrence_end


def event_has_occurrence(event: CalendarEvent, start: datetime, end: datetime) -> bool:
    return next(event_occurrence_ranges(event, start, end), None) is not None


def _event_expansion_duration(
    event: CalendarEvent,
    starts_at: datetime,
    ends_at: datetime,
) -> timedelta:
    if not event.all_day:
        return ends_at - starts_at
    zone = _zone(event.timezone)
    start_date = _local_date(starts_at, zone)
    end_date = _local_date(ends_at, zone)
    day_count = max(1, (end_date - start_date).days)
    return timedelta(days=day_count + 1)


def _occurrence_end(
    event: CalendarEvent,
    occurrence_start: datetime,
    duration: timedelta,
) -> datetime:
    if not event.all_day:
        return _safe_add(occurrence_start, duration)
    zone = _zone(event.timezone)
    stored_start = _local_date(_stored_utc(event.starts_at), zone)
    stored_end = _local_date(_stored_utc(event.ends_at), zone)
    day_count = max(1, (stored_end - stored_start).days)
    local_end_date = _safe_date_add(_local_date(occurrence_start, zone), day_count)
    try:
        return datetime.combine(local_end_date, time.min, tzinfo=zone).astimezone(timezone.utc)
    except (OverflowError, ValueError) as exc:
        raise ValueError("calendar event date is outside the supported timezone range") from exc


def _local_date(value: datetime, zone: ZoneInfo) -> date:
    try:
        return value.astimezone(zone).date()
    except (OverflowError, ValueError) as exc:
        raise ValueError("calendar event date is outside the supported timezone range") from exc


def _zone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise ValueError("calendar event timezone is not a valid IANA zone") from exc


def _safe_add(value: datetime, delta: timedelta) -> datetime:
    try:
        return value + delta
    except OverflowError:
        return UTC_MAX if delta >= timedelta() else UTC_MIN


def _safe_subtract(value: datetime, delta: timedelta) -> datetime:
    try:
        return value - delta
    except OverflowError:
        return UTC_MIN if delta >= timedelta() else UTC_MAX


def _safe_date_add(value: date, days: int) -> date:
    available = (date.max - value).days
    return date.max if days > available else value + timedelta(days=days)


def _stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
