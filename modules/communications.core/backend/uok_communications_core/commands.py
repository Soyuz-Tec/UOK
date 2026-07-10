from __future__ import annotations

from typing import Any, Callable

from pydantic import ValidationError
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.command_context import COMMAND_IF_MATCH_CONTEXT_KEY

from .schemas import CommunicationThreadCreateRequest
from .service import create_thread

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]


def cmd_create_communication_thread(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    try:
        request = CommunicationThreadCreateRequest.model_validate({
            key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY
        })
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid communication thread request")) from exc
    return create_thread(db, actor, request, command_id)


def command_handlers() -> dict[str, CommandHandler]:
    return {"CreateCommunicationThread": cmd_create_communication_thread}


def command_permissions() -> dict[str, str]:
    return {"CreateCommunicationThread": "communications.edit"}
