from __future__ import annotations

from typing import Any
from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .read_model import list_projects, schedule_read_model
from .schemas import (
    PlanningAssignmentRequest,
    PlanningBaselineRequest,
    PlanningCalendarRequest,
    PlanningDependencyRequest,
    PlanningDependencyUpdateRequest,
    PlanningProjectRequest,
    PlanningResourceRequest,
    PlanningTaskRequest,
    PlanningTaskUpdateRequest,
)
from .scheduler import project_or_error
from uok.commands import execute_command
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

router = APIRouter(prefix="/api/planning", tags=["planning"])


@router.get("/projects")
def projects(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    return list_projects(db, actor)


@router.post("/projects")
def create_project(req: PlanningProjectRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "CreatePlanningProject", req.model_dump(exclude_none=True), idempotency_key)


@router.get("/projects/{project_id}/schedule")
def project_schedule(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    return schedule_read_model(db, actor, project_or_error(db, actor, project_id))


@router.post("/projects/{project_id}/tasks")
def create_task(project_id: str, req: PlanningTaskRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningTask", payload, idempotency_key)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, req: PlanningTaskUpdateRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["task_id"] = task_id
    return run_planning_command(db, actor, "UpdatePlanningTask", payload, idempotency_key)


@router.delete("/tasks/{task_id}")
def delete_task(task_id: str, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "DeletePlanningTask", {"task_id": task_id}, idempotency_key)


@router.post("/projects/{project_id}/dependencies")
def link_tasks(project_id: str, req: PlanningDependencyRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "LinkPlanningTasks", payload, idempotency_key)


@router.patch("/dependencies/{dependency_id}")
def update_dependency(dependency_id: str, req: PlanningDependencyUpdateRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["dependency_id"] = dependency_id
    return run_planning_command(db, actor, "UpdatePlanningDependency", payload, idempotency_key)


@router.delete("/dependencies/{dependency_id}")
def remove_dependency(dependency_id: str, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "RemovePlanningDependency", {"dependency_id": dependency_id}, idempotency_key)


@router.put("/projects/{project_id}/calendar")
def set_calendar(project_id: str, req: PlanningCalendarRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "SetPlanningCalendar", payload, idempotency_key)


@router.post("/projects/{project_id}/baselines")
def create_baseline(project_id: str, req: PlanningBaselineRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningBaseline", payload, idempotency_key)


@router.post("/projects/{project_id}/resources")
def create_resource(project_id: str, req: PlanningResourceRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningResource", payload, idempotency_key)


@router.post("/assignments")
def assign_resource(req: PlanningAssignmentRequest, idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=1, max_length=180), actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "AssignPlanningResource", req.model_dump(exclude_none=True), idempotency_key)


def require_planning_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "planning.read")
        ensure_module_operational(db, actor.organization_id, "planning.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        status_code = 409 if str(exc).startswith("idempotency_key is already used") else 400
        raise HTTPException(status_code=status_code, detail={"error": str(exc)}) from exc


def run_planning_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, idempotency_key)["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
