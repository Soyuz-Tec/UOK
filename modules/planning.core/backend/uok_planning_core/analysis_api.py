from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from .analysis_schemas import PlanningRiskAnalysisRequest, PlanningWhatIfSnapshotRequest
from .api_contracts import PLANNING_MUTATION_RESPONSES
from .api_support import require_planning_read, run_planning_command
from .what_if import list_what_if_snapshots, what_if_detail, what_if_or_error
from .risk_analysis import analysis_detail, list_risk_analyses, risk_analysis_or_error
from uok.commands import MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH, MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH
from uok.db import get_db
from uok.security import Actor, current_actor

router = APIRouter(prefix="/api/planning", tags=["planning-analysis"])
AnalysisIdempotencyKey = Annotated[
    str,
    Header(
        ...,
        alias="Idempotency-Key",
        min_length=MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        max_length=MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    ),
]
AnalysisIfMatch = Annotated[str | None, Header(alias="If-Match")]


@router.post("/projects/{project_id}/what-if-snapshots", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_project_what_if_snapshot(
    project_id: str,
    req: PlanningWhatIfSnapshotRequest,
    response: Response,
    idempotency_key: AnalysisIdempotencyKey,
    if_match: AnalysisIfMatch = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningWhatIfSnapshot", payload, idempotency_key, response, if_match)


@router.get("/projects/{project_id}/what-if-snapshots")
def project_what_if_snapshots(
    project_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    return list_what_if_snapshots(db, actor, project_id)


@router.get("/projects/{project_id}/what-if-snapshots/{snapshot_id}")
def project_what_if_snapshot(
    project_id: str,
    snapshot_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    require_planning_read(db, actor)
    try:
        return what_if_detail(what_if_or_error(db, actor, project_id, snapshot_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.post("/projects/{project_id}/risk-analyses", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_project_risk_analysis(
    project_id: str,
    req: PlanningRiskAnalysisRequest,
    response: Response,
    idempotency_key: AnalysisIdempotencyKey,
    if_match: AnalysisIfMatch = None,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "RunPlanningRiskAnalysis", payload, idempotency_key, response, if_match)


@router.get("/projects/{project_id}/risk-analyses")
def project_risk_analyses(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    return list_risk_analyses(db, actor, project_id)


@router.get("/projects/{project_id}/risk-analyses/{run_id}")
def project_risk_analysis(project_id: str, run_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    try:
        return analysis_detail(risk_analysis_or_error(db, actor, project_id, run_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


__all__ = ["router"]
