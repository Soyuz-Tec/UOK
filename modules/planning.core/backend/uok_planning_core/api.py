from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from .read_model import list_projects
from .concurrency import read_locked_schedule_snapshot
from .schemas import (
    PlanningAssignmentRequest,
    PlanningBatchRequest,
    PlanningBaselineRequest,
    PlanningCalendarRequest,
    PlanningDependencyRequest,
    PlanningDependencyUpdateRequest,
    PlanningProjectRequest,
    PlanningResourceRequest,
    PlanningTaskRequest,
    PlanningTaskUpdateRequest,
)
from uok.commands import (
    COMMAND_ETAG_RESULT_KEY,
    CommandDomainError,
    CommandPreconditionError,
    IdempotencyConflictError,
    MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH,
    MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH,
    execute_command,
)
from uok.api.schemas import CommandDomainErrorResponse, CommandPreconditionResponse, IdempotencyConflictResponse
from uok.db import get_db
from uok.module_ops import ensure_module_operational
from uok.security import Actor, current_actor, require_permission

router = APIRouter(prefix="/api/planning", tags=["planning"])
ETAG_RESPONSE_HEADERS = {
    "ETag": {
        "description": "Quoted strong SHA-256 validator for the actor-visible Planning schedule.",
        "schema": {"type": "string"},
    }
}
IDEMPOTENCY_CONFLICT_RESPONSE = {
    409: {
        "model": IdempotencyConflictResponse,
        "description": "Idempotency key conflicts with another Planning request.",
    }
}
PLANNING_CREATE_RESPONSES = {
    **IDEMPOTENCY_CONFLICT_RESPONSE,
    200: {"description": "Project created at revision 1.", "headers": ETAG_RESPONSE_HEADERS},
}
PLANNING_MUTATION_RESPONSES = {
    **IDEMPOTENCY_CONFLICT_RESPONSE,
    400: {
        "model": CommandPreconditionResponse,
        "description": "The If-Match validator is malformed or inconsistent with expected_revision.",
    },
    200: {"description": "Mutation accepted and committed once.", "headers": ETAG_RESPONSE_HEADERS},
    412: {
        "model": CommandPreconditionResponse,
        "description": "The supplied strong ETag is stale; reload and explicitly reapply or keep the current schedule.",
    },
    428: {
        "model": CommandPreconditionResponse,
        "description": "A current strong Planning ETag is required.",
    },
}
PLANNING_BATCH_RESPONSES = {
    **PLANNING_MUTATION_RESPONSES,
    400: {
        "model": CommandDomainErrorResponse,
        "description": "A batch operation or the final proposed schedule is invalid.",
    },
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
PlanningIfMatch = Annotated[
    str | None,
    Header(
        alias="If-Match",
        description="Exactly one quoted strong ETag returned by the latest actor-visible schedule read.",
    ),
]


@router.get("/projects")
def projects(actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    require_planning_read(db, actor)
    return list_projects(db, actor)


@router.post("/projects", responses=PLANNING_CREATE_RESPONSES, response_model=None)
def create_project(req: PlanningProjectRequest, response: Response, idempotency_key: PlanningIdempotencyKey, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    return run_planning_command(db, actor, "CreatePlanningProject", req.model_dump(exclude_none=True), idempotency_key, response)


@router.get(
    "/projects/{project_id}/schedule",
    responses={200: {"description": "Actor-visible schedule snapshot.", "headers": ETAG_RESPONSE_HEADERS}},
)
def project_schedule(project_id: str, response: Response, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any]:
    require_planning_read(db, actor)
    try:
        schedule, etag = read_locked_schedule_snapshot(db, actor, project_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    response.headers["ETag"] = etag
    response.headers["Cache-Control"] = "private, no-store"
    response.headers["Vary"] = "Authorization"
    return schedule


@router.post("/projects/{project_id}/tasks", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_task(project_id: str, req: PlanningTaskRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningTask", payload, idempotency_key, response, if_match)


@router.patch("/tasks/{task_id}", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def update_task(task_id: str, req: PlanningTaskUpdateRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["task_id"] = task_id
    return run_planning_command(db, actor, "UpdatePlanningTask", payload, idempotency_key, response, if_match)


@router.delete("/tasks/{task_id}", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def delete_task(task_id: str, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    return run_planning_command(db, actor, "DeletePlanningTask", {"task_id": task_id}, idempotency_key, response, if_match)


@router.post("/projects/{project_id}/dependencies", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def link_tasks(project_id: str, req: PlanningDependencyRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "LinkPlanningTasks", payload, idempotency_key, response, if_match)


@router.patch("/dependencies/{dependency_id}", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def update_dependency(dependency_id: str, req: PlanningDependencyUpdateRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["dependency_id"] = dependency_id
    return run_planning_command(db, actor, "UpdatePlanningDependency", payload, idempotency_key, response, if_match)


@router.delete("/dependencies/{dependency_id}", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def remove_dependency(dependency_id: str, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    return run_planning_command(db, actor, "RemovePlanningDependency", {"dependency_id": dependency_id}, idempotency_key, response, if_match)


@router.put("/projects/{project_id}/calendar", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def set_calendar(project_id: str, req: PlanningCalendarRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "SetPlanningCalendar", payload, idempotency_key, response, if_match)


@router.post("/projects/{project_id}/baselines", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_baseline(project_id: str, req: PlanningBaselineRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningBaseline", payload, idempotency_key, response, if_match)


@router.post("/projects/{project_id}/resources", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def create_resource(project_id: str, req: PlanningResourceRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "CreatePlanningResource", payload, idempotency_key, response, if_match)


@router.post("/assignments", responses=PLANNING_MUTATION_RESPONSES, response_model=None)
def assign_resource(req: PlanningAssignmentRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    return run_planning_command(db, actor, "AssignPlanningResource", req.model_dump(exclude_none=True), idempotency_key, response, if_match)


@router.post("/projects/{project_id}/mutations:batch", responses=PLANNING_BATCH_RESPONSES, response_model=None)
def batch_mutations(project_id: str, req: PlanningBatchRequest, response: Response, idempotency_key: PlanningIdempotencyKey, if_match: PlanningIfMatch = None, actor: Actor = Depends(current_actor), db: Session = Depends(get_db)) -> dict[str, Any] | JSONResponse:
    payload = req.model_dump(exclude_none=True)
    payload["project_id"] = project_id
    return run_planning_command(db, actor, "BatchPlanningOperations", payload, idempotency_key, response, if_match)


def require_planning_read(db: Session, actor: Actor) -> None:
    try:
        require_permission(actor, "planning.read")
        ensure_module_operational(db, actor.organization_id, "planning.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def run_planning_command(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
    idempotency_key: str,
    response: Response,
    if_match: str | None = None,
) -> dict[str, Any] | JSONResponse:
    try:
        stored = execute_command(db, actor, command_type, payload, idempotency_key, if_match)["result"]
        result = dict(stored)
        etag = result.pop(COMMAND_ETAG_RESULT_KEY, None)
        if etag:
            response.headers["ETag"] = str(etag)
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["Vary"] = "Authorization"
        return result
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except IdempotencyConflictError as exc:
        raise HTTPException(status_code=409, detail={"error": str(exc)}) from exc
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
