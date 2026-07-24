from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

MAX_CALENDAR_NAME_LENGTH = 160
MAX_EVENT_TITLE_LENGTH = 240
MAX_EVENT_TEXT_LENGTH = 5000
MAX_RRULE_LENGTH = 500
MAX_SOURCE_FIELD_LENGTH = 120
VALID_VISIBILITY_SCOPES = {"private", "team", "organization"}
VALID_EVENT_STATUSES = {"confirmed", "tentative", "canceled"}
VALID_TRANSPARENCY = {"busy", "free"}
VALID_REMINDER_TYPES = {"in_app", "email"}
VALID_PARTICIPANT_TYPES = {"party", "person", "resource", "room"}
VALID_PARTICIPANT_ROLES = {"chair", "non_participant", "optional", "required"}
VALID_RESPONSE_STATUSES = {"accepted", "declined", "delegated", "needs_action", "tentative"}


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def bounded_text(value: Any, field: str, limit: int) -> str:
    text = clean_text(value)
    if len(text) > limit:
        raise ValueError(f"{field} must be {limit} characters or fewer")
    return text


def optional_text(value: Any, field: str, limit: int) -> str | None:
    text = bounded_text(value, field, limit)
    return text or None


def object_payload(value: Any, field: str) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError(f"{field} must be an object")
    return dict(value)


def valid_timezone(value: Any) -> str:
    timezone_name = bounded_text(value or "UTC", "timezone", 80)
    try:
        ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("timezone must be a valid IANA time zone") from exc
    return timezone_name


def as_utc_datetime(value: Any, field: str) -> datetime:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str):
        raw = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError as exc:
            raise ValueError(f"{field} must be an ISO datetime") from exc
    else:
        raise ValueError(f"{field} must be an ISO datetime")
    if dt.tzinfo is None or dt.utcoffset() is None:
        raise ValueError(f"{field} must include a timezone offset")
    return dt.astimezone(timezone.utc)


def visibility_scope(value: Any) -> str:
    scope = bounded_text(value or "organization", "visibility_scope", 40)
    if scope not in VALID_VISIBILITY_SCOPES:
        raise ValueError(f"visibility_scope must be one of {', '.join(sorted(VALID_VISIBILITY_SCOPES))}")
    return scope


def event_status(value: Any) -> str:
    status = bounded_text(value or "confirmed", "status", 40)
    if status not in VALID_EVENT_STATUSES:
        raise ValueError(f"status must be one of {', '.join(sorted(VALID_EVENT_STATUSES))}")
    return status


def transparency(value: Any) -> str:
    item = bounded_text(value or "busy", "transparency", 40)
    if item not in VALID_TRANSPARENCY:
        raise ValueError(f"transparency must be one of {', '.join(sorted(VALID_TRANSPARENCY))}")
    return item


def reminder_type(value: Any) -> str:
    item = bounded_text(value or "in_app", "reminder_type", 40)
    if item not in VALID_REMINDER_TYPES:
        raise ValueError(f"reminder_type must be one of {', '.join(sorted(VALID_REMINDER_TYPES))}")
    return item


def participant_type(value: Any) -> str:
    item = bounded_text(value, "participant_type", 40)
    if item not in VALID_PARTICIPANT_TYPES:
        raise ValueError(f"participant_type must be one of {', '.join(sorted(VALID_PARTICIPANT_TYPES))}")
    return item


def participant_role(value: Any) -> str:
    item = bounded_text(value or "required", "role", 40)
    if item not in VALID_PARTICIPANT_ROLES:
        raise ValueError(f"role must be one of {', '.join(sorted(VALID_PARTICIPANT_ROLES))}")
    return item


def response_status(value: Any) -> str:
    item = bounded_text(value or "needs_action", "response_status", 40)
    if item not in VALID_RESPONSE_STATUSES:
        raise ValueError(f"response_status must be one of {', '.join(sorted(VALID_RESPONSE_STATUSES))}")
    return item
