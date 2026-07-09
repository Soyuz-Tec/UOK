from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from uok.commands import execute_command
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

from .ics_codec import export_ics
from .read_model import event_or_error, freebusy_rows, list_calendars, occurrence_rows, serialize_event
from .schemas import CalendarWriteRequest, EventPatchRequest, EventWriteRequest, ReminderWriteRequest
from .validation import as_utc_datetime

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


def require_calendar_module_operational(db: Session, actor: Actor) -> None:
    try:
        ensure_module_operational(db, actor.organization_id, "calendar.core")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_calendar_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, f"{command_type}:{uuid4()}")["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/calendars")
def calendars(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_permission(actor, "calendar.read")
    require_calendar_module_operational(db, actor)
    return list_calendars(db, actor)


@router.post("/calendars")
def create_calendar(req: CalendarWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "CreateCalendar", req.model_dump(exclude_none=True))


@router.patch("/calendars/{calendar_id}")
def update_calendar(calendar_id: str, req: CalendarWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["calendar_id"] = calendar_id
    return run_calendar_command(db, actor, "UpdateCalendar", payload)


@router.delete("/calendars/{calendar_id}")
def delete_calendar(calendar_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "DeleteCalendar", {"calendar_id": calendar_id})


@router.get("/events")
def events(
    from_at: datetime,
    to_at: datetime,
    calendar_id: str | None = None,
    include_canceled: bool = False,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "calendar.read")
    require_calendar_module_operational(db, actor)
    start = as_utc_datetime(from_at, "from_at")
    end = as_utc_datetime(to_at, "to_at")
    if end <= start:
        raise HTTPException(status_code=400, detail={"error": "to_at must be after from_at"})
    return occurrence_rows(db, actor, start, end, calendar_id, include_canceled)


@router.post("/events")
def create_event(req: EventWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "CreateCalendarEvent", req.model_dump(exclude_none=True))


@router.get("/events/{event_id}")
def event_detail(event_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "calendar.read")
    require_calendar_module_operational(db, actor)
    try:
        return serialize_event(db, event_or_error(db, actor, event_id), include_detail=True)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/events/{event_id}")
def update_event(event_id: str, req: EventPatchRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["event_id"] = event_id
    return run_calendar_command(db, actor, "UpdateCalendarEvent", payload)


@router.post("/events/{event_id}/cancel")
def cancel_event(event_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "CancelCalendarEvent", {"event_id": event_id})


@router.post("/events/{event_id}/restore")
def restore_event(event_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "RestoreCalendarEvent", {"event_id": event_id})


@router.post("/events/{event_id}/reminders")
def create_reminder(event_id: str, req: ReminderWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["event_id"] = event_id
    return run_calendar_command(db, actor, "CreateCalendarReminder", payload)


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "DeleteCalendarReminder", {"reminder_id": reminder_id})


@router.get("/freebusy")
def freebusy(from_at: datetime, to_at: datetime, calendar_id: str | None = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "calendar.freebusy.read")
    require_calendar_module_operational(db, actor)
    start = as_utc_datetime(from_at, "from_at")
    end = as_utc_datetime(to_at, "to_at")
    if end <= start:
        raise HTTPException(status_code=400, detail={"error": "to_at must be after from_at"})
    return {"busy": freebusy_rows(db, actor, start, end, calendar_id)}


@router.get("/ics/export")
def ics_export(from_at: datetime, to_at: datetime, calendar_id: str | None = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> Response:
    require_permission(actor, "calendar.ics.export")
    require_calendar_module_operational(db, actor)
    body = export_ics(db, actor, as_utc_datetime(from_at, "from_at"), as_utc_datetime(to_at, "to_at"), calendar_id)
    return Response(content=body, media_type="text/calendar; charset=utf-8", headers={"Content-Disposition": "attachment; filename=uok-calendar.ics"})
