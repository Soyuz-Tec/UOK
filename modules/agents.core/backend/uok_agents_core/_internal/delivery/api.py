from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from uok.host.database import get_db
from uok.host.security import current_actor
from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor, require_permission

from .read_service import (
    approval_queue,
    list_runbooks,
    list_runs,
    run_decisions,
    run_detail,
    run_evidence,
    runbook_detail,
)
from .response_schemas import AgentApprovalResponse, AgentEvidenceResponse, AgentRunResponse, AgentRunbookResponse


router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("/runbooks", response_model=list[AgentRunbookResponse])
def runbooks(
    include_archived: bool = False,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_access(db, actor, "agents.read")
    return list_runbooks(db, actor, include_archived, limit, offset)


@router.get("/runbooks/{runbook_id}", response_model=AgentRunbookResponse)
def runbook(
    runbook_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_access(db, actor, "agents.read")
    return _read(lambda: runbook_detail(db, actor, runbook_id))


@router.get("/runs", response_model=list[AgentRunResponse])
def runs(
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_access(db, actor, "agents.read")
    return _read(lambda: list_runs(db, actor, status, limit, offset))


@router.get("/runs/{run_id}", response_model=AgentRunResponse)
def run(
    run_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_access(db, actor, "agents.read")
    return _read(lambda: run_detail(db, actor, run_id))


@router.get("/approval-queue", response_model=list[AgentRunResponse])
def approvals(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_access(db, actor, "agents.approve")
    return approval_queue(db, actor, limit, offset)


@router.get("/runs/{run_id}/decisions", response_model=list[AgentApprovalResponse])
def decisions(
    run_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_access(db, actor, "agents.audit")
    return _read(lambda: run_decisions(db, actor, run_id))


@router.get("/runs/{run_id}/evidence", response_model=list[AgentEvidenceResponse])
def evidence(
    run_id: str,
    actor: Actor = Depends(current_actor),
    db: Session = Depends(get_db),
) -> list[dict[str, object]]:
    _require_access(db, actor, "agents.audit")
    return _read(lambda: run_evidence(db, actor, run_id))


def _require_access(db: Session, actor: Actor, permission: str) -> None:
    try:
        require_permission(actor, permission)
        ensure_module_operational(db, actor.organization_id, "agents.core")
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def _read(operation):
    try:
        return operation()
    except ValueError as exc:
        message = str(exc)
        status = 404 if message.endswith("not found") else 400
        raise HTTPException(status_code=status, detail={"error": message}) from exc


__all__ = ["router"]
