from __future__ import annotations

import re
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from dateutil.rrule import rrulestr

from .validation import MAX_RRULE_LENGTH, bounded_text

ALLOWED_RRULE_KEYS = {
    "FREQ",
    "INTERVAL",
    "COUNT",
    "UNTIL",
    "BYDAY",
    "BYMONTH",
    "BYMONTHDAY",
    "WKST",
}
ALLOWED_FREQUENCIES = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}
MAX_RECURRENCE_COUNT = 366
MAX_EXPANSION_DAYS = 370
MAX_RECURRENCE_SPAN_DAYS = 366 * 366
RECURRENCE_LIMIT_ERROR = f"recurrence cannot contain more than {MAX_RECURRENCE_COUNT} effective occurrences"
RECURRENCE_HORIZON_ERROR = "recurrence cannot span more than 366 years"
BYDAY_TOKEN = re.compile(r"^([+-]?\d{1,2})?(MO|TU|WE|TH|FR|SA|SU)$")


def normalize_rrule(value: str | None) -> str | None:
    rule = bounded_text(value or "", "recurrence_rule", MAX_RRULE_LENGTH).upper()
    if not rule:
        return None
    if rule.startswith("RRULE:"):
        rule = rule[6:]
    parts = [part for part in rule.split(";") if part]
    values = _parts_to_values(parts)
    frequency = values.get("FREQ")
    if frequency not in ALLOWED_FREQUENCIES:
        raise ValueError(f"recurrence FREQ must be one of {', '.join(sorted(ALLOWED_FREQUENCIES))}")
    if int(values.get("INTERVAL", "1")) < 1:
        raise ValueError("recurrence INTERVAL must be at least 1")
    if "COUNT" in values:
        count = int(values["COUNT"])
        if count < 1 or count > MAX_RECURRENCE_COUNT:
            raise ValueError(f"recurrence COUNT must be between 1 and {MAX_RECURRENCE_COUNT}")
    _validate_by_parts(values)
    return ";".join(parts)


def validate_rrule(
    rule: str | None,
    starts_at: datetime,
    timezone_name: str = "UTC",
    *,
    has_external_boundary: bool = False,
) -> str | None:
    normalized = normalize_rrule(rule)
    if normalized is None:
        return None
    values = _parts_to_values(normalized.split(";"))
    if has_external_boundary:
        _recurrence(normalized, starts_at, timezone_name)
        return normalized
    if "COUNT" not in values and "UNTIL" not in values:
        normalized = f"{normalized};COUNT={MAX_RECURRENCE_COUNT}"
    last = _bounded_last_occurrence(_recurrence(normalized, starts_at, timezone_name))
    _validate_recurrence_horizon(starts_at, last)
    return normalized


def validate_recurrence_until_limit(
    rule: str,
    starts_at: datetime,
    timezone_name: str,
    recurrence_until: datetime,
) -> None:
    normalized = normalize_rrule(rule)
    if not normalized:
        raise ValueError("recurrence_until requires recurrence_rule")
    until = _aware_utc(recurrence_until, "recurrence_until")
    last = _bounded_last_occurrence(_recurrence(normalized, starts_at, timezone_name), until)
    if last is None:
        raise ValueError("recurrence_until must include at least the first occurrence")
    _validate_recurrence_horizon(starts_at, last)


def expanded_starts(
    rule: str | None,
    starts_at: datetime,
    window_start: datetime,
    window_end: datetime,
    *,
    timezone_name: str = "UTC",
    recurrence_until: datetime | None = None,
) -> list[datetime]:
    starts_at = _aware_utc(starts_at, "starts_at")
    window_start = _aware_utc(window_start, "window_start")
    window_end = _aware_utc(window_end, "window_end")
    rule = normalize_rrule(rule)
    if not rule:
        return [starts_at] if starts_at < window_end else []
    expansion_horizon = timedelta(days=MAX_EXPANSION_DAYS)
    max_end = window_end if window_end - window_start <= expansion_horizon else window_start + expansion_horizon
    until = _aware_utc(recurrence_until, "recurrence_until") if recurrence_until else None
    if until:
        max_end = min(max_end, until)
    if max_end < window_start:
        return []
    recurrence = _recurrence(rule, starts_at, timezone_name)
    starts: list[datetime] = []
    for index, occurrence in enumerate(recurrence):
        if index >= MAX_RECURRENCE_COUNT:
            break
        occurrence_utc = occurrence.astimezone(timezone.utc)
        if until and occurrence_utc > until:
            break
        if occurrence_utc > max_end:
            break
        if occurrence_utc >= window_start:
            starts.append(occurrence_utc)
    return starts


def rrule_for_export(
    rule: str | None,
    starts_at: datetime,
    timezone_name: str,
    recurrence_until: datetime | None,
    *,
    all_day: bool = False,
) -> str | None:
    """Return one RFC 5545 rule whose end includes the stored series boundary."""
    normalized = normalize_rrule(rule)
    if not normalized:
        return normalized
    values = _parts_to_values(normalized.split(";"))
    recurrence = _recurrence(normalized, starts_at, timezone_name)
    if recurrence_until is None:
        if "COUNT" not in values and "UNTIL" not in values:
            return f"{normalized};COUNT={MAX_RECURRENCE_COUNT}"
        _bounded_last_occurrence(recurrence)
        return normalized
    until_utc = _aware_utc(recurrence_until, "recurrence_until")
    zone = ZoneInfo(timezone_name)
    last = _bounded_last_occurrence(recurrence, until_utc)
    if last is None:
        raise ValueError("recurrence_until must include at least the first occurrence")
    retained = [part for part in normalized.split(";") if not part.startswith(("COUNT=", "UNTIL="))]
    until_value = (
        last.astimezone(zone).strftime("%Y%m%d")
        if all_day
        else last.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    )
    retained.append(f"UNTIL={until_value}")
    return ";".join(retained)


def _recurrence(rule: str, starts_at: datetime, timezone_name: str):
    try:
        local_start = _aware_utc(starts_at, "starts_at").astimezone(ZoneInfo(timezone_name))
        return rrulestr(rule, dtstart=local_start)
    except Exception as exc:  # dateutil raises several parsing exceptions.
        raise ValueError("recurrence_rule is not valid RFC 5545 RRULE syntax") from exc


def _bounded_last_occurrence(recurrence, boundary: datetime | None = None) -> datetime | None:
    last = None
    for count, occurrence in enumerate(recurrence, start=1):
        occurrence_utc = occurrence.astimezone(timezone.utc)
        if boundary is not None and occurrence_utc > boundary:
            break
        if count > MAX_RECURRENCE_COUNT:
            raise ValueError(RECURRENCE_LIMIT_ERROR)
        last = occurrence
    return last


def _validate_recurrence_horizon(starts_at: datetime, last: datetime | None) -> None:
    if last is None:
        return
    span = last.astimezone(timezone.utc) - _aware_utc(starts_at, "starts_at")
    if span > timedelta(days=MAX_RECURRENCE_SPAN_DAYS):
        raise ValueError(RECURRENCE_HORIZON_ERROR)


def _validate_by_parts(values: dict[str, str]) -> None:
    months = _integer_list(values.get("BYMONTH"), "BYMONTH", 1, 12)
    month_days = _integer_list(values.get("BYMONTHDAY"), "BYMONTHDAY", -31, 31, disallow_zero=True)
    if months and month_days and not any(_month_day_exists(month, day) for month in months for day in month_days):
        raise ValueError("recurrence_rule BYMONTH and BYMONTHDAY do not identify a valid calendar date")
    if "WKST" in values and values["WKST"] not in {"MO", "TU", "WE", "TH", "FR", "SA", "SU"}:
        raise ValueError("recurrence_rule WKST must be a weekday")
    for token in values.get("BYDAY", "").split(",") if values.get("BYDAY") else []:
        match = BYDAY_TOKEN.fullmatch(token)
        if not match:
            raise ValueError("recurrence_rule BYDAY contains an invalid weekday")
        ordinal = int(match.group(1)) if match.group(1) else None
        if ordinal is not None and (ordinal == 0 or abs(ordinal) > 5 or values["FREQ"] not in {"MONTHLY", "YEARLY"}):
            raise ValueError("recurrence_rule BYDAY ordinal must be between -5 and 5 for monthly or yearly recurrence")


def _integer_list(
    value: str | None,
    field: str,
    minimum: int,
    maximum: int,
    *,
    disallow_zero: bool = False,
) -> list[int]:
    if not value:
        return []
    try:
        values = [int(item) for item in value.split(",")]
    except ValueError as exc:
        raise ValueError(f"recurrence_rule {field} must contain integers") from exc
    if any(item < minimum or item > maximum or (disallow_zero and item == 0) for item in values):
        raise ValueError(f"recurrence_rule {field} contains an out-of-range value")
    return values


def _month_day_exists(month: int, day: int) -> bool:
    return any(abs(day) <= monthrange(year, month)[1] for year in (2023, 2024))


def _parts_to_values(parts: list[str]) -> dict[str, str]:
    if not parts or not any(part.startswith("FREQ=") for part in parts):
        raise ValueError("recurrence_rule must contain FREQ")
    values: dict[str, str] = {}
    for part in parts:
        key, _, raw_value = part.partition("=")
        if key not in ALLOWED_RRULE_KEYS or not raw_value:
            raise ValueError(f"recurrence_rule contains unsupported key {key}")
        if key in values:
            raise ValueError(f"recurrence_rule repeats key {key}")
        values[key] = raw_value
    if "COUNT" in values and "UNTIL" in values:
        raise ValueError("recurrence_rule must not contain both COUNT and UNTIL")
    return values


def _aware_utc(value: datetime, field: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field} must include a timezone offset")
    return value.astimezone(timezone.utc)
