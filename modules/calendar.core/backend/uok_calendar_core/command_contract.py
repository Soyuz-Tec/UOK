from __future__ import annotations

from typing import Any

from .validation import event_status

NON_NULLABLE_EVENT_PATCH_FIELDS = {
    "title",
    "starts_at",
    "ends_at",
    "timezone",
    "all_day",
    "transparency",
    "attrs",
    "participants",
    "reminders",
}


def creatable_event_status(value: Any) -> str:
    status = event_status(value)
    if status == "canceled":
        raise ValueError("canceled events must use the event cancellation lifecycle")
    return status


def validate_event_patch_payload(payload: dict[str, Any]) -> None:
    if "status" in payload:
        raise ValueError("status must be changed through the event cancel or restore command")
    for field in sorted(NON_NULLABLE_EVENT_PATCH_FIELDS & payload.keys()):
        if payload.get(field) is None:
            raise ValueError(f"{field} cannot be null")


def command_permissions() -> dict[str, str]:
    return {
        "CreateCalendar": "calendar.manage",
        "UpdateCalendar": "calendar.manage",
        "DeleteCalendar": "calendar.manage",
        "RestoreCalendar": "calendar.manage",
        "CreateCalendarEvent": "calendar.event.create",
        "UpdateCalendarEvent": "calendar.event.update",
        "CancelCalendarEvent": "calendar.event.cancel",
        "RestoreCalendarEvent": "calendar.event.restore",
        "CreateCalendarReminder": "calendar.reminder.manage",
        "DeleteCalendarReminder": "calendar.reminder.manage",
    }
