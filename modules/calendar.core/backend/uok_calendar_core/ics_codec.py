from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from uok.security import Actor

from .read_model import event_rows


def _escape_text(value: Any) -> str:
    text = str(value or "")
    return text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _dtstamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _fold(line: str) -> list[str]:
    if len(line) <= 75:
        return [line]
    chunks = [line[:75]]
    rest = line[75:]
    while rest:
        chunks.append(" " + rest[:74])
        rest = rest[74:]
    return chunks


def _add(lines: list[str], name: str, value: Any) -> None:
    if value is None:
        return
    lines.extend(_fold(f"{name}:{value}"))


def export_ics(db: Session, actor: Actor, start: datetime, end: datetime, calendar_id: str | None = None) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//UOK//calendar.core//EN",
        "CALSCALE:GREGORIAN",
    ]
    for event in event_rows(db, actor, start, end, calendar_id, include_canceled=False):
        lines.append("BEGIN:VEVENT")
        _add(lines, "UID", event.uid)
        _add(lines, "DTSTAMP", _dtstamp(event.updated_at or event.created_at))
        _add(lines, "DTSTART", _dtstamp(event.starts_at))
        _add(lines, "DTEND", _dtstamp(event.ends_at))
        _add(lines, "SUMMARY", _escape_text(event.title))
        _add(lines, "DESCRIPTION", _escape_text(event.description))
        _add(lines, "LOCATION", _escape_text(event.location))
        _add(lines, "STATUS", event.status.upper())
        if event.recurrence_rule:
            _add(lines, "RRULE", event.recurrence_rule)
        lines.append("END:VEVENT")
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"
