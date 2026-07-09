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
ALLOWED_FREQUENCIES = {"DAILY", "WEEKLY", "MONTHLY", "YEARLY"}
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
    values = _parts_to_values(parts)
    frequency = values.get("FREQ")
    if frequency not in ALLOWED_FREQUENCIES:
        raise ValueError(f"recurrence FREQ must be one of {', '.join(sorted(ALLOWED_FREQUENCIES))}")
    if int(values.get("INTERVAL", "1")) < 1:
        raise ValueError("recurrence INTERVAL must be at least 1")
    if "COUNT" in values and int(values["COUNT"]) > MAX_RECURRENCE_COUNT:
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
    starts: list[datetime] = []
    for occurrence in recurrence.between(window_start, max_end, inc=True):
        starts.append(occurrence)
        if len(starts) >= MAX_EXPANDED_OCCURRENCES:
            break
    return starts


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
    return values
