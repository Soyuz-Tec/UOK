from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .read_model import list_projects, schedule_read_model
from .schemas import PlanningDependencyRequest, PlanningProjectRequest, PlanningTaskRequest, PlanningTaskUpdateRequest
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
def create_project(req: PlanningProjectRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "CreatePlanningProject", req.model_dump(exclude_none=True))


@router.get("/projects/{project_id}/schedule")
def project_schedule(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    return schedule_read_model(db, actor, project_or_error(db, actor, project_id))


@router.post("/projects/{project_id}/tasks")
def create_task(project_id: str, req: PlanningTaskRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningTask", payload)


@router.patch("/tasks/{task_id}")
def update_task(task_id: str, req: PlanningTaskUpdateRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["task_id"] = task_id
    return run_planning_command(db, actor, "UpdatePlanningTask", payload)


@router.post("/projects/{project_id}/dependencies")
def link_tasks(project_id: str, req: PlanningDependencyRequest, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "LinkPlanningTasks", payload)


def require_planning_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "planning.read")
        ensure_module_operational(db, actor.organization_id, "planning.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_planning_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, f"{command_type}:{uuid4()}")["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
