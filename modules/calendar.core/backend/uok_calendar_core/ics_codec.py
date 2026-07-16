from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from .ics_timezone import local_date_value, local_datetime_value, timezone_component_lines
from .occurrence_support import event_has_occurrence
from .read_model import event_rows, participant_rows, reminder_rows, stored_utc
from .recurrence import rrule_for_export


def _escape_text(value: Any) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _dtstamp(value: datetime) -> str:
    return stored_utc(value).strftime("%Y%m%dT%H%M%SZ")


def _fold(line: str) -> list[str]:
    if len(line.encode("utf-8")) <= 75:
        return [line]
    first, rest = _utf8_prefix(line, 75)
    chunks = [first]
    while rest:
        chunk, rest = _utf8_prefix(rest, 74)
        chunks.append(" " + chunk)
    return chunks


def _add(lines: list[str], name: str, value: Any) -> None:
    if value is None:
        return
    lines.extend(_fold(f"{name}:{value}"))


def _utf8_prefix(value: str, byte_limit: int) -> tuple[str, str]:
    used = 0
    split_at = 0
    for index, character in enumerate(value):
        size = len(character.encode("utf-8"))
        if used + size > byte_limit:
            break
        used += size
        split_at = index + 1
    return value[:split_at], value[split_at:]


def _date_values(event) -> tuple[str, str]:
    start = local_date_value(event.starts_at, event.timezone)
    end = local_date_value(event.ends_at, event.timezone)
    if end <= start:
        if start == datetime.max.date():
            raise ValueError("all-day event end exceeds the supported ICS date range")
        end = start + timedelta(days=1)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")


def _add_attendees(lines: list[str], participants: list[dict[str, Any]]) -> None:
    roles = {
        "required": "REQ-PARTICIPANT",
        "optional": "OPT-PARTICIPANT",
        "chair": "CHAIR",
        "non_participant": "NON-PARTICIPANT",
    }
    statuses = {
        "needs_action": "NEEDS-ACTION",
        "accepted": "ACCEPTED",
        "declined": "DECLINED",
        "tentative": "TENTATIVE",
        "delegated": "DELEGATED",
    }
    for participant in participants:
        email = str(participant.get("email") or "").strip()
        if not email or any(ord(character) < 32 or ord(character) == 127 for character in email):
            continue
        name = _escape_parameter(participant.get("display_name") or email)
        role = roles.get(str(participant.get("role") or "required"), "REQ-PARTICIPANT")
        status = statuses.get(str(participant.get("response_status") or "needs_action"), "NEEDS-ACTION")
        _add(lines, f'ATTENDEE;CN="{name}";ROLE={role};PARTSTAT={status}', f"mailto:{email}")


def _escape_parameter(value: Any) -> str:
    text = str(value or "").replace("\r\n", "\n").replace("\r", "\n")
    return text.replace("^", "^^").replace("\n", "^n").replace('"', "^'")


def _add_alarms(lines: list[str], title: str, reminders: list[dict[str, Any]]) -> None:
    for reminder in reminders:
        minutes = int(reminder["trigger_minutes_before"])
        lines.append("BEGIN:VALARM")
        _add(lines, "ACTION", "DISPLAY")
        _add(lines, "DESCRIPTION", _escape_text(f"Reminder: {title}"))
        _add(lines, "TRIGGER", "PT0M" if minutes == 0 else f"-PT{minutes}M")
        lines.append("END:VALARM")


def export_ics(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None) -> str:
    prepared: list[tuple[Any, str | None]] = []
    for event in event_rows(db, actor, start, end, calendar_id, include_canceled=False):
        if not event_has_occurrence(event, start, end):
            continue
        recurrence_until = stored_utc(event.recurrence_until) if event.recurrence_until else None
        export_rule = rrule_for_export(
            event.recurrence_rule,
            stored_utc(event.starts_at),
            event.timezone,
            recurrence_until,
            all_day=bool(event.all_day),
        )
        prepared.append((event, export_rule))
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//UOK//calendar.core//EN",
        "CALSCALE:GREGORIAN",
    ]
    lines.extend(timezone_component_lines(prepared))
    for event, export_rule in prepared:
        lines.append("BEGIN:VEVENT")
        _add(lines, "UID", event.uid)
        _add(lines, "DTSTAMP", _dtstamp(event.updated_at or event.created_at))
        _add(lines, "LAST-MODIFIED", _dtstamp(event.updated_at or event.created_at))
        if event.all_day:
            start_date, end_date = _date_values(event)
            _add(lines, "DTSTART;VALUE=DATE", start_date)
            _add(lines, "DTEND;VALUE=DATE", end_date)
        elif event.timezone == "UTC":
            _add(lines, "DTSTART", _dtstamp(event.starts_at))
            _add(lines, "DTEND", _dtstamp(event.ends_at))
        else:
            _add(lines, f"DTSTART;TZID={event.timezone}", local_datetime_value(event.starts_at, event.timezone))
            _add(lines, f"DTEND;TZID={event.timezone}", local_datetime_value(event.ends_at, event.timezone))
        _add(lines, "SUMMARY", _escape_text(event.title))
        _add(lines, "DESCRIPTION", _escape_text(event.description))
        _add(lines, "LOCATION", _escape_text(event.location))
        _add(lines, "STATUS", event.status.upper())
        _add(lines, "TRANSP", "TRANSPARENT" if event.transparency == "free" else "OPAQUE")
        _add(lines, "RRULE", export_rule)
        _add_attendees(lines, participant_rows(db, event.id))
        _add_alarms(lines, event.title, reminder_rows(db, event.id))
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
