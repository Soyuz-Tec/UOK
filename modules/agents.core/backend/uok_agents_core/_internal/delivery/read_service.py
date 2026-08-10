from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor

from uok_agents_core._internal.persistence.models import AgentApproval, AgentEvidence, AgentRun, AgentRunbook

from .run_service import get_run
from .runbook_service import get_runbook
from .serializers import approval_response, evidence_response, run_response, runbook_response


RUN_STATUSES = frozenset({
    "draft",
    "awaiting_approval",
    "approved",
    "revision_requested",
    "rejected",
    "escalated",
    "completed",
    "failed",
})


def list_runbooks(
    db: Session,
    actor: Actor,
    include_archived: bool,
    limit: int,
    offset: int,
) -> list[dict[str, object]]:
    statement = select(AgentRunbook).where(AgentRunbook.organization_id == actor.organization_id)
    if not include_archived:
        statement = statement.where(AgentRunbook.status == "active")
    rows = db.scalars(statement.order_by(AgentRunbook.name, AgentRunbook.id).limit(limit).offset(offset)).all()
    return [runbook_response(row) for row in rows]


def runbook_detail(db: Session, actor: Actor, runbook_id: str) -> dict[str, object]:
    return runbook_response(get_runbook(db, actor, runbook_id))


def list_runs(
    db: Session,
    actor: Actor,
    status: str | None,
    limit: int,
    offset: int,
) -> list[dict[str, object]]:
    if status is not None and status not in RUN_STATUSES:
        raise ValueError("unknown agent run status")
    statement = select(AgentRun).where(AgentRun.organization_id == actor.organization_id)
    if status:
        statement = statement.where(AgentRun.status == status)
    rows = db.scalars(statement.order_by(AgentRun.created_at.desc(), AgentRun.id.desc()).limit(limit).offset(offset)).all()
    return [run_response(row) for row in rows]


def approval_queue(db: Session, actor: Actor, limit: int, offset: int) -> list[dict[str, object]]:
    rows = db.scalars(select(AgentRun).where(
        AgentRun.organization_id == actor.organization_id,
        AgentRun.status.in_(("awaiting_approval", "escalated")),
    ).order_by(AgentRun.created_at, AgentRun.id).limit(limit).offset(offset)).all()
    return [run_response(row) for row in rows]


def run_detail(db: Session, actor: Actor, run_id: str) -> dict[str, object]:
    return run_response(get_run(db, actor, run_id))


def run_decisions(db: Session, actor: Actor, run_id: str) -> list[dict[str, object]]:
    get_run(db, actor, run_id)
    rows = db.scalars(select(AgentApproval).where(
        AgentApproval.organization_id == actor.organization_id,
        AgentApproval.run_id == run_id,
    ).order_by(AgentApproval.decided_at, AgentApproval.id)).all()
    return [approval_response(row) for row in rows]


def run_evidence(db: Session, actor: Actor, run_id: str) -> list[dict[str, object]]:
    get_run(db, actor, run_id)
    rows = db.scalars(select(AgentEvidence).where(
        AgentEvidence.organization_id == actor.organization_id,
        AgentEvidence.run_id == run_id,
    ).order_by(AgentEvidence.created_at, AgentEvidence.id)).all()
    return [evidence_response(row) for row in rows]


__all__ = [
    "approval_queue",
    "list_runbooks",
    "list_runs",
    "run_decisions",
    "run_detail",
    "run_evidence",
    "runbook_detail",
]
