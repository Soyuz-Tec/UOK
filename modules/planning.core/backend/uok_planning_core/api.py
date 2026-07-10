from __future__ import annotations

from typing import Annotated, Any

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
from uok.commands import (
    IdempotencyConflictError,
    MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH,
    MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH,
    execute_command,
)
from uok.api.schemas import IdempotencyConflictResponse
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

router = APIRouter(prefix="/api/planning", tags=["planning"])
IDEMPOTENCY_CONFLICT_RESPONSE = {
    409: {
        "model": IdempotencyConflictResponse,
        "description": "Idempotency key conflicts with another Planning request.",
    }
}
PlanningIdempotencyKey = Annotated[
    str,
    Header(
        ...,
        alias="Idempotency-Key",
        min_length=MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        max_length=MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
    ),
]


@router.get("/projects")
def projects(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    return list_projects(db, actor)


@router.post("/projects", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def create_project(req: PlanningProjectRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "CreatePlanningProject", req.model_dump(exclude_none=True), idempotency_key)


@router.get("/projects/{project_id}/schedule")
def project_schedule(project_id: str, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    return schedule_read_model(db, actor, project_or_error(db, actor, project_id))


@router.post("/projects/{project_id}/tasks", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def create_task(project_id: str, req: PlanningTaskRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningTask", payload, idempotency_key)


@router.patch("/tasks/{task_id}", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def update_task(task_id: str, req: PlanningTaskUpdateRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["task_id"] = task_id
    return run_planning_command(db, actor, "UpdatePlanningTask", payload, idempotency_key)


@router.delete("/tasks/{task_id}", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def delete_task(task_id: str, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "DeletePlanningTask", {"task_id": task_id}, idempotency_key)


@router.post("/projects/{project_id}/dependencies", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def link_tasks(project_id: str, req: PlanningDependencyRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "LinkPlanningTasks", payload, idempotency_key)


@router.patch("/dependencies/{dependency_id}", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def update_dependency(dependency_id: str, req: PlanningDependencyUpdateRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["dependency_id"] = dependency_id
    return run_planning_command(db, actor, "UpdatePlanningDependency", payload, idempotency_key)


@router.delete("/dependencies/{dependency_id}", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def remove_dependency(dependency_id: str, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "RemovePlanningDependency", {"dependency_id": dependency_id}, idempotency_key)


@router.put("/projects/{project_id}/calendar", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def set_calendar(project_id: str, req: PlanningCalendarRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "SetPlanningCalendar", payload, idempotency_key)


@router.post("/projects/{project_id}/baselines", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def create_baseline(project_id: str, req: PlanningBaselineRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningBaseline", payload, idempotency_key)


@router.post("/projects/{project_id}/resources", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def create_resource(project_id: str, req: PlanningResourceRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningResource", payload, idempotency_key)


@router.post("/assignments", responses=IDEMPOTENCY_CONFLICT_RESPONSE)
def assign_resource(req: PlanningAssignmentRequest, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    return run_planning_command(db, actor, "AssignPlanningResource", req.model_dump(exclude_none=True), idempotency_key)


def require_planning_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "planning.read")
        ensure_module_operational(db, actor.organization_id, "planning.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_planning_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any], idempotency_key: str) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, idempotency_key)["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc)}) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
