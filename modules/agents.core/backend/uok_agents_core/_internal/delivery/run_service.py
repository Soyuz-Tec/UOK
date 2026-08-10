from __future__ import annotations

from hashlib import sha256

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.module_runtime import ensure_module_operational
from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event
from uok.util import dumps

from uok_agents_core._internal.persistence.models import AgentApproval, AgentRun

from .evidence import record_evidence
from .plan_policy import validate_plan
from .request_schemas import (
    AgentDecisionRequest,
    AgentOverrideRequest,
    AgentPlanSubmitRequest,
    AgentRunCompleteRequest,
    AgentRunFailRequest,
    AgentRunStartRequest,
)
from .runbook_service import get_runbook
from .serializers import run_response


def start_run(db: Session, actor: Actor, request: AgentRunStartRequest, command_id: str) -> dict[str, object]:
    runbook = get_runbook(db, actor, request.runbook_id)
    if runbook.status != "active":
        raise ValueError("archived agent runbook cannot start a run")
    ensure_module_operational(db, actor.organization_id, runbook.target_module)
    now = utcnow()
    row = AgentRun(
        organization_id=actor.organization_id,
        runbook_id=runbook.id,
        runbook_version=runbook.version,
        target_module=runbook.target_module,
        risk_level=runbook.risk_level,
        approval_policy=runbook.approval_policy,
        allowed_tools_json=runbook.allowed_tools_json,
        allowed_commands_json=runbook.allowed_commands_json,
        allowed_data_scopes_json=runbook.allowed_data_scopes_json,
        input_json=dumps(request.input_context),
        requested_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    record_evidence(db, actor, row.id, "input", "Run input captured", {"input_context": request.input_context})
    _emit_run_event(db, actor, "AgentRunStarted", row, command_id)
    return run_response(row, command_id)


def submit_plan(
    db: Session,
    actor: Actor,
    request: AgentPlanSubmitRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_run(db, actor, request.run_id)
    _assert_version(row, request.expected_version)
    ensure_module_operational(db, actor.organization_id, row.target_module)
    plan, reason = validate_plan(row, request)
    plan_json = dumps(plan)
    row.plan_kind = request.plan_kind
    row.plan_json = plan_json
    row.plan_sha256 = sha256(plan_json.encode("utf-8")).hexdigest()
    row.status = "awaiting_approval" if reason else "approved"
    row.approval_reason = reason
    _touch(row)
    record_evidence(db, actor, row.id, "plan", request.summary, {
        "plan": plan,
        "plan_sha256": row.plan_sha256,
        "policy_status": row.status,
        "approval_reason": reason,
    })
    _emit_run_event(db, actor, "AgentPlanSubmitted", row, command_id, {
        "plan_kind": request.plan_kind,
        "plan_sha256": row.plan_sha256,
        "approval_required": reason is not None,
    })
    return run_response(row, command_id)


def decide_run(
    db: Session,
    actor: Actor,
    request: AgentDecisionRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_run(db, actor, request.run_id)
    _assert_version(row, request.expected_version)
    if row.status not in {"awaiting_approval", "escalated"}:
        raise ValueError(f"agent run does not accept a decision from status {row.status}")
    resulting_status = {
        "approve": "approved",
        "reject": "rejected",
        "request_revision": "revision_requested",
        "escalate": "escalated",
    }[request.decision]
    if row.status == "escalated" and resulting_status == "escalated":
        raise ValueError("agent run is already escalated")
    _record_decision(db, actor, row, resulting_status, request.reason)
    row.status = resulting_status
    row.decided_at = utcnow()
    _touch(row)
    record_evidence(db, actor, row.id, "decision", f"Run {resulting_status.replace('_', ' ')}", {
        "decision": resulting_status,
        "reason": request.reason,
    })
    _emit_run_event(db, actor, "AgentRunDecisionRecorded", row, command_id, {"decision": resulting_status})
    return run_response(row, command_id)


def override_run(
    db: Session,
    actor: Actor,
    request: AgentOverrideRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_run(db, actor, request.run_id)
    _assert_version(row, request.expected_version)
    if row.status not in {"awaiting_approval", "escalated", "rejected"}:
        raise ValueError(f"agent run cannot be overridden from status {row.status}")
    _record_decision(db, actor, row, "overridden", request.reason)
    row.status = "approved"
    row.decided_at = utcnow()
    _touch(row)
    record_evidence(db, actor, row.id, "override", "Run policy overridden", {"reason": request.reason})
    _emit_run_event(db, actor, "AgentRunOverridden", row, command_id)
    return run_response(row, command_id)


def complete_run(
    db: Session,
    actor: Actor,
    request: AgentRunCompleteRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_run(db, actor, request.run_id)
    _assert_version(row, request.expected_version)
    if row.status != "approved":
        raise ValueError("agent run must be approved before completion")
    ensure_module_operational(db, actor.organization_id, row.target_module)
    row.status = "completed"
    row.completed_at = utcnow()
    _touch(row)
    record_evidence(db, actor, row.id, "outcome", request.outcome_summary, {"outcome": request.outcome})
    _emit_run_event(db, actor, "AgentRunCompleted", row, command_id)
    return run_response(row, command_id)


def fail_run(
    db: Session,
    actor: Actor,
    request: AgentRunFailRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_run(db, actor, request.run_id)
    _assert_version(row, request.expected_version)
    if row.status not in {"draft", "approved"}:
        raise ValueError(f"agent run cannot fail from status {row.status}")
    row.status = "failed"
    _touch(row)
    record_evidence(db, actor, row.id, "failure", request.reason, {
        "failure_context": request.failure_context,
    })
    _emit_run_event(db, actor, "AgentRunFailed", row, command_id)
    return run_response(row, command_id)


def get_run(db: Session, actor: Actor, run_id: str, *, lock: bool = False) -> AgentRun:
    statement = select(AgentRun).where(
        AgentRun.id == run_id,
        AgentRun.organization_id == actor.organization_id,
    )
    row = db.scalar(statement.with_for_update() if lock else statement)
    if row is None:
        raise ValueError("agent run not found")
    return row


def _locked_run(db: Session, actor: Actor, run_id: str) -> AgentRun:
    return get_run(db, actor, run_id, lock=True)


def _assert_version(row: AgentRun, expected: int) -> None:
    if row.version != expected:
        raise ValueError(f"agent run version conflict; current version {row.version}")


def _touch(row: AgentRun) -> None:
    row.version += 1
    row.updated_at = utcnow()


def _record_decision(db: Session, actor: Actor, row: AgentRun, decision: str, reason: str) -> None:
    db.add(AgentApproval(
        organization_id=actor.organization_id,
        run_id=row.id,
        decision=decision,
        reason=reason,
        decided_by_user_id=actor.user_id,
    ))
    db.flush()


def _emit_run_event(
    db: Session,
    actor: Actor,
    event: str,
    row: AgentRun,
    command_id: str,
    extra: dict[str, object] | None = None,
) -> None:
    emit_module_event(db, actor, event, "AgentRun", row.id, {
        "correlation_id": command_id,
        "runbook_id": row.runbook_id,
        "run_version": row.version,
        "status": row.status,
        **(extra or {}),
    })


__all__ = ["complete_run", "decide_run", "fail_run", "get_run", "override_run", "start_run", "submit_plan"]
