from __future__ import annotations

from typing import Any, Callable, TypeVar

from pydantic import BaseModel, ValidationError
from sqlalchemy.orm import Session

from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY
from uok.kernel.security import Actor

from .request_schemas import (
    AgentDecisionRequest,
    AgentOverrideRequest,
    AgentPlanSubmitRequest,
    AgentRunCompleteRequest,
    AgentRunFailRequest,
    AgentRunStartRequest,
    AgentRunbookArchiveRequest,
    AgentRunbookCreateRequest,
    AgentRunbookUpdateRequest,
)
from .run_service import complete_run, decide_run, fail_run, override_run, start_run, submit_plan
from .runbook_service import archive_runbook, create_runbook, update_runbook


CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]
RequestModel = TypeVar("RequestModel", bound=BaseModel)


def _handler(service: Callable[..., dict[str, object]], model: type[RequestModel]) -> CommandHandler:
    def handle(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
        return service(db, actor, _validate(model, payload), command_id)

    return handle


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateAgentRunbook": _handler(create_runbook, AgentRunbookCreateRequest),
        "UpdateAgentRunbook": _handler(update_runbook, AgentRunbookUpdateRequest),
        "ArchiveAgentRunbook": _handler(archive_runbook, AgentRunbookArchiveRequest),
        "StartAgentRun": _handler(start_run, AgentRunStartRequest),
        "SubmitAgentPlan": _handler(submit_plan, AgentPlanSubmitRequest),
        "DecideAgentRun": _handler(decide_run, AgentDecisionRequest),
        "OverrideAgentRun": _handler(override_run, AgentOverrideRequest),
        "CompleteAgentRun": _handler(complete_run, AgentRunCompleteRequest),
        "FailAgentRun": _handler(fail_run, AgentRunFailRequest),
    }


def command_permissions() -> dict[str, str]:
    return {
        "CreateAgentRunbook": "agents.manage",
        "UpdateAgentRunbook": "agents.manage",
        "ArchiveAgentRunbook": "agents.manage",
        "StartAgentRun": "agents.run",
        "SubmitAgentPlan": "agents.run",
        "DecideAgentRun": "agents.approve",
        "OverrideAgentRun": "agents.override",
        "CompleteAgentRun": "agents.run",
        "FailAgentRun": "agents.run",
    }


def _validate(model: type[RequestModel], payload: dict[str, Any]) -> RequestModel:
    clean_payload = {key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY}
    try:
        return model.model_validate(clean_payload)
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid agent request")) from exc


__all__ = ["command_handlers", "command_permissions"]
