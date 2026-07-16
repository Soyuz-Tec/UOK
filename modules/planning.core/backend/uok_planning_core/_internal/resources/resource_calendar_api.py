from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from uok_planning_core._internal.delivery.api_contracts import PLANNING_MUTATION_RESPONSES
from uok_planning_core._internal.delivery.api_support import run_planning_command
from uok_planning_core._internal.delivery.schemas import PlanningResourceCalendarRequest
from uok.commands import MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH, MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH
from uok.db import get_db
from uok.security import Actor, current_actor

router = APIRouter()
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH, max_length=MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH, pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")]
IfMatch = Annotated[str | None, Header(alias="If-Match")]


@router.put("/api/planning/projects/{project_id}/resources/{resource_id}/calendar", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def set_resource_calendar(
    project_id: str,
    resource_id: str,
    req: PlanningResourceCalendarRequest,
    response: Response,
    idempotency_key: IdempotencyKey,
    if_match: IfMatch = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload.update({"project_id": project_id, "resource_id": resource_id})
    return run_planning_command(db, actor, "SetPlanningResourceCalendar", payload, idempotency_key, response, if_match)


__all__ = ["router"]
