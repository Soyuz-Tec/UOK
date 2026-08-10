from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from uok.kernel.module_runtime import ensure_module_operational, module_catalog
from uok.kernel.security import Actor
from uok.models_base import utcnow
from uok.module_events import emit_module_event
from uok.util import dumps

from uok_agents_core._internal.persistence.models import AgentRun, AgentRunbook

from .plan_policy import SUPPORTED_TOOL_BINDINGS
from .request_schemas import AgentRunbookArchiveRequest, AgentRunbookCreateRequest, AgentRunbookUpdateRequest
from .serializers import runbook_response


def create_runbook(
    db: Session,
    actor: Actor,
    request: AgentRunbookCreateRequest,
    command_id: str,
) -> dict[str, object]:
    _validate_scope(db, actor, request)
    now = utcnow()
    row = AgentRunbook(
        organization_id=actor.organization_id,
        name=request.name,
        description=request.description,
        goal=request.goal,
        target_module=request.target_module,
        allowed_tools_json=dumps(request.allowed_tools),
        allowed_commands_json=dumps(request.allowed_commands),
        allowed_data_scopes_json=dumps(request.allowed_data_scopes),
        risk_level=request.risk_level,
        approval_policy=request.approval_policy,
        created_by_user_id=actor.user_id,
        updated_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    _flush_unique(db, "runbook name already exists in this organization")
    _emit_runbook_event(db, actor, "AgentRunbookCreated", row, command_id)
    return runbook_response(row, command_id)


def update_runbook(
    db: Session,
    actor: Actor,
    request: AgentRunbookUpdateRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_runbook(db, actor, request.runbook_id)
    _assert_version(row, request.expected_version)
    if row.status != "active":
        raise ValueError("archived agent runbook cannot be updated")
    _validate_scope(db, actor, request)
    for field in ("name", "description", "goal", "target_module", "risk_level", "approval_policy"):
        setattr(row, field, getattr(request, field))
    row.allowed_tools_json = dumps(request.allowed_tools)
    row.allowed_commands_json = dumps(request.allowed_commands)
    row.allowed_data_scopes_json = dumps(request.allowed_data_scopes)
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()
    row.version += 1
    _flush_unique(db, "runbook name already exists in this organization")
    _emit_runbook_event(db, actor, "AgentRunbookUpdated", row, command_id)
    return runbook_response(row, command_id)


def archive_runbook(
    db: Session,
    actor: Actor,
    request: AgentRunbookArchiveRequest,
    command_id: str,
) -> dict[str, object]:
    row = _locked_runbook(db, actor, request.runbook_id)
    _assert_version(row, request.expected_version)
    if row.status == "archived":
        raise ValueError("agent runbook is already archived")
    active_run = db.scalar(select(AgentRun.id).where(
        AgentRun.organization_id == actor.organization_id,
        AgentRun.runbook_id == row.id,
        AgentRun.status.not_in(("completed", "rejected")),
    ).limit(1))
    if active_run is not None:
        raise ValueError("agent runbook has an active or recoverable run")
    row.status = "archived"
    row.updated_by_user_id = actor.user_id
    row.updated_at = utcnow()
    row.archived_at = row.updated_at
    row.version += 1
    db.flush()
    _emit_runbook_event(db, actor, "AgentRunbookArchived", row, command_id)
    return runbook_response(row, command_id)


def get_runbook(db: Session, actor: Actor, runbook_id: str, *, lock: bool = False) -> AgentRunbook:
    statement = select(AgentRunbook).where(
        AgentRunbook.id == runbook_id,
        AgentRunbook.organization_id == actor.organization_id,
    )
    row = db.scalar(statement.with_for_update() if lock else statement)
    if row is None:
        raise ValueError("agent runbook not found")
    return row


def _locked_runbook(db: Session, actor: Actor, runbook_id: str) -> AgentRunbook:
    return get_runbook(db, actor, runbook_id, lock=True)


def _validate_scope(db: Session, actor: Actor, request: AgentRunbookCreateRequest) -> None:
    if request.target_module == "agents.core":
        raise ValueError("an agent runbook cannot target agents.core")
    manifests = module_catalog()
    target = manifests.get(request.target_module)
    if target is None:
        raise ValueError("target_module is not declared")
    ensure_module_operational(db, actor.organization_id, request.target_module)
    unsupported_tools = sorted(set(request.allowed_tools) - SUPPORTED_TOOL_BINDINGS)
    if unsupported_tools:
        raise ValueError(f"unsupported tool bindings: {', '.join(unsupported_tools)}")
    undeclared_commands = sorted(set(request.allowed_commands) - set(target.get("commands", [])))
    if undeclared_commands:
        raise ValueError(f"target module does not declare commands: {', '.join(undeclared_commands)}")
    undeclared_scopes = sorted(set(request.allowed_data_scopes) - set(target.get("permissions", [])))
    if undeclared_scopes:
        raise ValueError(f"target module does not declare data scopes: {', '.join(undeclared_scopes)}")


def _assert_version(row: AgentRunbook, expected: int) -> None:
    if row.version != expected:
        raise ValueError(f"agent runbook version conflict; current version {row.version}")


def _flush_unique(db: Session, message: str) -> None:
    try:
        db.flush()
    except IntegrityError as exc:
        raise ValueError(message) from exc


def _emit_runbook_event(db: Session, actor: Actor, event: str, row: AgentRunbook, command_id: str) -> None:
    emit_module_event(db, actor, event, "AgentRunbook", row.id, {
        "correlation_id": command_id,
        "runbook_version": row.version,
        "target_module": row.target_module,
        "risk_level": row.risk_level,
    })


__all__ = ["archive_runbook", "create_runbook", "get_runbook", "update_runbook"]
