from __future__ import annotations

from datetime import datetime, timedelta

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
MAX_RECURRENCE_COUNT = 366
MAX_EXPANSION_DAYS = 370
MAX_EXPANDED_OCCURRENCES = 500


def normalize_rrule(value: str | None) -> str | None:
    rule = bounded_text(value or "", "recurrence_rule", MAX_RRULE_LENGTH).upper()
    if not rule:
        return None
    if rule.startswith("RRULE:"):
        rule = rule[6:]
    parts = [part for part in rule.split(";") if part]
    if not parts or not any(part.startswith("FREQ=") for part in parts):
        raise ValueError("recurrence_rule must contain FREQ")
    for part in parts:
        key, _, raw_value = part.partition("=")
        if key not in ALLOWED_RRULE_KEYS or not raw_value:
            raise ValueError(f"recurrence_rule contains unsupported key {key}")
        if key == "COUNT" and int(raw_value) > MAX_RECURRENCE_COUNT:
            raise ValueError(f"recurrence COUNT cannot exceed {MAX_RECURRENCE_COUNT}")
    return ";".join(parts)


def validate_rrule(rule: str | None, starts_at: datetime) -> str | None:
    normalized = normalize_rrule(rule)
    if normalized is None:
        return None
    try:
        rrulestr(normalized, dtstart=starts_at)
    except Exception as exc:  # dateutil raises several parsing exceptions.
        raise ValueError("recurrence_rule is not valid RFC 5545 RRULE syntax") from exc
    return normalized


def expanded_starts(rule: str | None, starts_at: datetime, window_start: datetime, window_end: datetime) -> list[datetime]:
    if not rule:
        return [starts_at] if starts_at < window_end else []
    max_end = min(window_end, window_start + timedelta(days=MAX_EXPANSION_DAYS))
    recurrence = rrulestr(rule, dtstart=starts_at)
    return list(recurrence.between(window_start, max_end, inc=True)[:MAX_EXPANDED_OCCURRENCES])
