from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from uok.api.schemas import CommandPreconditionResponse
from uok.commands import (
    COMMAND_ETAG_RESULT_KEY,
    CommandDomainError,
    CommandPermissionError,
    CommandPreconditionError,
    execute_command,
)
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

from .ics_codec import export_ics
from .concurrency import strong_event_etag
from .policy import capability_read_model
from .read_model import event_or_error, freebusy_rows, list_calendars, occurrence_rows, serialize_event
from .schemas import CalendarPatchRequest, CalendarWriteRequest, EventPatchRequest, EventWriteRequest, ReminderWriteRequest
from .validation import as_utc_datetime

router = APIRouter(prefix="/api/calendar", tags=["calendar"])
CALENDAR_ETAG_HEADERS = {
    "ETag": {
        "description": "Strong validator for the returned Calendar aggregate or event detail.",
        "schema": {"type": "string"},
    },
}
CALENDAR_UPDATE_RESPONSES = {
    200: {"description": "Event updated with a new strong ETag.", "headers": CALENDAR_ETAG_HEADERS},
    412: {"model": CommandPreconditionResponse, "description": "The supplied event ETag is stale."},
    428: {"model": CommandPreconditionResponse, "description": "A current event ETag is required."},
}
CALENDAR_LIFECYCLE_RESPONSES = {
    200: {"description": "Calendar lifecycle updated with a new strong ETag.", "headers": CALENDAR_ETAG_HEADERS},
    412: {"model": CommandPreconditionResponse, "description": "The supplied Calendar ETag is stale."},
    428: {"model": CommandPreconditionResponse, "description": "A current Calendar ETag is required."},
}


def require_calendar_module_operational(db: Session, actor: Actor) -> None:
    try:
        ensure_module_operational(db, actor.organization_id, "calendar.core")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/capabilities")
def calendar_capabilities(
    response: Response,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, bool]:
    require_permission(actor, "calendar.read")
    require_calendar_module_operational(db, actor)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return capability_read_model(actor)


def run_calendar_command(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
    response: Response | None = None,
    if_match: str | None = None,
) -> dict[str, Any] | JSONResponse:
    try:
        stored = execute_command(db, actor, command_type, payload, f"{command_type}:{uuid4()}", if_match)["result"]
        result = dict(stored)
        etag = result.pop(COMMAND_ETAG_RESULT_KEY, None)
        if response is not None and etag:
            _set_private_etag(response, str(etag))
        return result
    except CommandPermissionError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body())
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except CommandPreconditionError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.response_body(),
            headers={"ETag": exc.current_etag, "Cache-Control": "private, no-store", "Vary": "Authorization"},
        )
    except CommandDomainError as exc:
        return JSONResponse(status_code=exc.status_code, content=exc.response_body())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def _set_private_etag(response: Response, etag: str) -> None:
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"


@router.get("/calendars")
def calendars(
    response: Response,
    include_deleted: bool = Query(default=False),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_permission(actor, "calendar.read")
    if include_deleted:
        require_permission(actor, "calendar.manage")
    require_calendar_module_operational(db, actor)
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return list_calendars(db, actor, include_deleted=include_deleted)


@router.post("/calendars")
def create_calendar(req: CalendarWriteRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_calendar_command(db, actor, "CreateCalendar", req.model_dump(exclude_none=True))


@router.patch("/calendars/{calendar_id}")
def update_calendar(calendar_id: str, req: CalendarPatchRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["calendar_id"] = calendar_id
    return run_calendar_command(db, actor, "UpdateCalendar", payload)


@router.delete("/calendars/{calendar_id}", responses=CALENDAR_LIFECYCLE_RESPONSES, response_model=None)
def delete_calendar(
    calendar_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    return run_calendar_command(db, actor, "DeleteCalendar", {"calendar_id": calendar_id}, response, if_match)


@router.post("/calendars/{calendar_id}/restore", responses=CALENDAR_LIFECYCLE_RESPONSES, response_model=None)
def restore_calendar(
    calendar_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    return run_calendar_command(db, actor, "RestoreCalendar", {"calendar_id": calendar_id}, response, if_match)


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
    try:
        return occurrence_rows(db, actor, start, end, calendar_id, include_canceled)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.post("/events")
def create_event(req: EventWriteRequest, response: Response, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> Any:
    return run_calendar_command(db, actor, "CreateCalendarEvent", req.model_dump(exclude_none=True), response)


@router.get("/events/{event_id}", responses={200: {"description": "Actor-visible event detail.", "headers": CALENDAR_ETAG_HEADERS}})
def event_detail(event_id: str, response: Response, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "calendar.read")
    require_calendar_module_operational(db, actor)
    try:
        event = event_or_error(db, actor, event_id)
        result = serialize_event(db, event, include_detail=True)
        _set_private_etag(response, strong_event_etag(db, event))
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/events/{event_id}", responses=CALENDAR_UPDATE_RESPONSES, response_model=None)
def update_event(
    event_id: str,
    req: EventPatchRequest,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    payload = req.model_dump(exclude_unset=True)
    payload["event_id"] = event_id
    return run_calendar_command(db, actor, "UpdateCalendarEvent", payload, response, if_match)


@router.post("/events/{event_id}/cancel", responses=CALENDAR_UPDATE_RESPONSES)
def cancel_event(
    event_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    return run_calendar_command(db, actor, "CancelCalendarEvent", {"event_id": event_id}, response, if_match)


@router.post("/events/{event_id}/restore", responses=CALENDAR_UPDATE_RESPONSES)
def restore_event(
    event_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    return run_calendar_command(db, actor, "RestoreCalendarEvent", {"event_id": event_id}, response, if_match)


@router.post("/events/{event_id}/reminders", responses=CALENDAR_UPDATE_RESPONSES)
def create_reminder(
    event_id: str,
    req: ReminderWriteRequest,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    payload = req.model_dump(exclude_none=True)
    payload["event_id"] = event_id
    return run_calendar_command(db, actor, "CreateCalendarReminder", payload, response, if_match)


@router.delete("/reminders/{reminder_id}", responses=CALENDAR_UPDATE_RESPONSES)
def delete_reminder(
    reminder_id: str,
    response: Response,
    if_match: str | None = Header(default=None, alias="If-Match"),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> Any:
    return run_calendar_command(db, actor, "DeleteCalendarReminder", {"reminder_id": reminder_id}, response, if_match)


@router.get("/freebusy")
def freebusy(from_at: datetime, to_at: datetime, calendar_id: str | None = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_permission(actor, "calendar.freebusy.read")
    require_calendar_module_operational(db, actor)
    start = as_utc_datetime(from_at, "from_at")
    end = as_utc_datetime(to_at, "to_at")
    if end <= start:
        raise HTTPException(status_code=400, detail={"error": "to_at must be after from_at"})
    try:
        return {"busy": freebusy_rows(db, actor, start, end, calendar_id)}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/ics/export")
def ics_export(from_at: datetime, to_at: datetime, calendar_id: str | None = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> Response:
    require_permission(actor, "calendar.ics.export")
    require_calendar_module_operational(db, actor)
    start = as_utc_datetime(from_at, "from_at")
    end = as_utc_datetime(to_at, "to_at")
    if end <= start:
        raise HTTPException(status_code=400, detail={"error": "to_at must be after from_at"})
    try:
        body = export_ics(db, actor, start, end, calendar_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    return Response(content=body, media_type="text/calendar; charset=utf-8", headers={"Content-Disposition": "attachment; filename=uok-calendar.ics"})
