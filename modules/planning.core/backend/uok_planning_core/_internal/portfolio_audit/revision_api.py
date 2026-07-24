from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from uok_planning_core._internal.delivery.api_support import require_planning_read
from uok_planning_core._internal.portfolio_audit.revision_history import PlanningRevisionNotFound, list_project_revisions, project_revision_detail
from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.security import Actor

router = APIRouter(prefix="/api/planning", tags=["planning-history"])


class PlanningOutboxMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    event_type: str
    schema_version: int
    checksum: str
    created_at: datetime


class PlanningRevisionMetadata(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    project_id: str
    revision: int = Field(ge=1)
    previous_revision: int = Field(ge=0)
    correlation_id: str
    command_type: str
    source_command_id: str | None
    task_versions: dict[str, int]
    changed_task_ids: list[str]
    revision_checksum: str
    created_at: datetime
    outbox: PlanningOutboxMetadata


class PlanningRevisionPage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    project_id: str
    items: list[PlanningRevisionMetadata]
    limit: int
    offset: int


@router.get("/projects/{project_id}/revisions", response_model=PlanningRevisionPage)
def project_revisions(
    project_id: str,
    response: Response,
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10_000),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    require_planning_read(db, actor)
    _private_no_store(response)
    try:
        return list_project_revisions(db, actor, project_id, limit=limit, offset=offset)
    except PlanningRevisionNotFound as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


@router.get("/projects/{project_id}/revisions/{revision_number}", response_model=PlanningRevisionMetadata)
def project_revision(
    project_id: str,
    revision_number: int,
    response: Response,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    require_planning_read(db, actor)
    _private_no_store(response)
    if revision_number < 1:
        raise HTTPException(status_code=422, detail={"error": "revision_number must be positive"})
    try:
        return project_revision_detail(db, actor, project_id, revision_number)
    except PlanningRevisionNotFound as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc)}) from exc


def _private_no_store(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"


__all__ = ["router"]
