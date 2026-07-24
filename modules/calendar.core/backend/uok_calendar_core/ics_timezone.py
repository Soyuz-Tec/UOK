from __future__ import annotations

from datetime import date, datetime, timezone
from functools import lru_cache
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from dateutil.rrule import rrulestr
from icalendar import Timezone

from .recurrence import MAX_RECURRENCE_COUNT, MAX_RECURRENCE_SPAN_DAYS

MAX_ICS_TIMEZONE_SPAN_DAYS = MAX_RECURRENCE_SPAN_DAYS + 367
MAX_VTIMEZONE_BYTES = 131_072


def local_datetime_value(value: datetime, timezone_name: str) -> str:
    try:
        return _stored_utc(value).astimezone(ZoneInfo(timezone_name)).strftime("%Y%m%dT%H%M%S")
    except (OverflowError, ValueError, ZoneInfoNotFoundError) as exc:
        raise ValueError("calendar event date is outside the supported ICS timezone range") from exc


def local_date_value(value: datetime, timezone_name: str) -> date:
    try:
        return _stored_utc(value).astimezone(ZoneInfo(timezone_name)).date()
    except (OverflowError, ValueError, ZoneInfoNotFoundError) as exc:
        raise ValueError("calendar event date is outside the supported ICS timezone range") from exc


def timezone_component_lines(events: list[tuple[Any, str | None]]) -> list[str]:
    bounds: dict[str, tuple[date, date]] = {}
    for event, export_rule in events:
        if event.all_day or event.timezone == "UTC":
            continue
        first = local_date_value(event.starts_at, event.timezone)
        last = local_date_value(_effective_end(event, export_rule), event.timezone)
        if (last - first).days > MAX_ICS_TIMEZONE_SPAN_DAYS:
            raise ValueError("calendar export timezone span exceeds the operational limit")
        current = bounds.get(event.timezone)
        bounds[event.timezone] = (
            min(first, current[0]) if current else first,
            max(last, current[1]) if current else last,
        )
    lines: list[str] = []
    for timezone_name, (first, last) in sorted(bounds.items()):
        lines.extend(_timezone_lines(timezone_name, _safe_date_add(first, -1), _safe_date_add(last, 1)))
    return lines


def _effective_end(event: Any, export_rule: str | None) -> datetime:
    event_start = _stored_utc(event.starts_at)
    event_end = _stored_utc(event.ends_at)
    if not export_rule:
        return event_end
    last_start = _last_export_occurrence(export_rule, event_start, event.timezone)
    try:
        return max(last_start, last_start + (event_end - event_start))
    except OverflowError as exc:
        raise ValueError("calendar export event duration exceeds the datetime range") from exc


def _last_export_occurrence(rule: str, starts_at: datetime, timezone_name: str) -> datetime:
    try:
        local_start = starts_at.astimezone(ZoneInfo(timezone_name))
        recurrence = rrulestr(rule, dtstart=local_start)
        last = None
        for count, occurrence in enumerate(recurrence, start=1):
            if count > MAX_RECURRENCE_COUNT:
                raise ValueError("calendar export recurrence exceeds the occurrence limit")
            last = occurrence.astimezone(timezone.utc)
    except (OverflowError, ValueError, ZoneInfoNotFoundError) as exc:
        if isinstance(exc, ValueError) and str(exc).startswith("calendar export"):
            raise
        raise ValueError("calendar export recurrence could not be expanded") from exc
    if last is None:
        raise ValueError("calendar export recurrence has no effective occurrence")
    return last


@lru_cache(maxsize=32)
def _timezone_lines(timezone_name: str, first: date, last: date) -> tuple[str, ...]:
    try:
        payload = Timezone.from_tzid(
            timezone_name,
            first_date=first,
            last_date=last,
        ).to_ical()
    except (OverflowError, ValueError) as exc:
        raise ValueError("calendar timezone could not be represented for ICS export") from exc
    if len(payload) > MAX_VTIMEZONE_BYTES:
        raise ValueError("calendar timezone component exceeds the export size limit")
    return tuple(line.decode("utf-8") for line in payload.splitlines())


def _safe_date_add(value: date, days: int) -> date:
    ordinal = max(date.min.toordinal(), min(date.max.toordinal(), value.toordinal() + days))
    return date.fromordinal(ordinal)


def _stored_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
