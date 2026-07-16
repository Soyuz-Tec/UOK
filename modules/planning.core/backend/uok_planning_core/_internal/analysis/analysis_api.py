from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.orm import Session

from uok_planning_core._internal.analysis.analysis_schemas import (
    PlanningOptimizationRequest,
    PlanningRecommendationDecisionRequest,
    PlanningRecommendationMutationRequest,
    PlanningRiskAnalysisRequest,
    PlanningWhatIfSnapshotRequest,
)
from uok_planning_core._internal.delivery.api_contracts import PLANNING_MUTATION_RESPONSES
from uok_planning_core._internal.delivery.api_support import require_planning_read, run_planning_command
from uok_planning_core._internal.analysis.what_if import list_what_if_snapshots, what_if_detail, what_if_or_error
from uok_planning_core._internal.analysis.risk_analysis import analysis_detail, list_risk_analyses, risk_analysis_or_error
from uok_planning_core._internal.analysis.optimization import list_optimizations, list_recommendations, optimization_detail, optimization_or_error
from uok.commands import MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH, MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH
from uok.host.database import get_db
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
    try:
        return list_what_if_snapshots(db, actor, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


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
    try:
        return list_risk_analyses(db, actor, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/projects/{project_id}/risk-analyses/{run_id}")
def project_risk_analysis(project_id: str, run_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    try:
        return analysis_detail(risk_analysis_or_error(db, actor, project_id, run_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.post("/projects/{project_id}/optimizations", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_project_optimization(project_id: str, req: PlanningOptimizationRequest, response: Response, idempotency_key: AnalysisIdempotencyKey, if_match: AnalysisIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "RunPlanningOptimization", {**req.model_dump(exclude_none=True), "project_id": project_id}, idempotency_key, response, if_match)


@router.get("/projects/{project_id}/optimizations")
def project_optimizations(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    try:
        return list_optimizations(db, actor, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/projects/{project_id}/optimizations/{run_id}")
def project_optimization(project_id: str, run_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    try:
        return optimization_detail(db, actor, optimization_or_error(db, actor, project_id, run_id))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.get("/projects/{project_id}/recommendations")
def project_recommendations(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    try:
        return list_recommendations(db, actor, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


@router.post("/projects/{project_id}/recommendations/{recommendation_id}/decision", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def decide_project_recommendation(project_id: str, recommendation_id: str, req: PlanningRecommendationDecisionRequest, response: Response, idempotency_key: AnalysisIdempotencyKey, if_match: AnalysisIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = {**req.model_dump(exclude_none=True), "project_id": project_id, "recommendation_id": recommendation_id}
    return run_planning_command(db, actor, "DecidePlanningRecommendation", payload, idempotency_key, response, if_match)


@router.post("/projects/{project_id}/recommendations/{recommendation_id}/apply", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def apply_project_recommendation(project_id: str, recommendation_id: str, req: PlanningRecommendationMutationRequest, response: Response, idempotency_key: AnalysisIdempotencyKey, if_match: AnalysisIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "ApplyPlanningRecommendation", {**req.model_dump(exclude_none=True), "project_id": project_id, "recommendation_id": recommendation_id}, idempotency_key, response, if_match)


@router.post("/projects/{project_id}/recommendations/{recommendation_id}/rollback", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def rollback_project_recommendation(project_id: str, recommendation_id: str, req: PlanningRecommendationMutationRequest, response: Response, idempotency_key: AnalysisIdempotencyKey, if_match: AnalysisIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "RollbackPlanningRecommendation", {**req.model_dump(exclude_none=True), "project_id": project_id, "recommendation_id": recommendation_id}, idempotency_key, response, if_match)


__all__ = ["router"]
