from __future__ import annotations

from typing import Any, Callable

from pydantic import ValidationError
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.kernel.command_contracts import COMMAND_IF_MATCH_CONTEXT_KEY

from .lifecycle import archive_thread, restore_thread
from .schemas import CommunicationThreadCreateRequest, CommunicationThreadLifecycleRequest
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


def cmd_archive_communication_thread(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    request = _lifecycle_request(payload)
    return archive_thread(db, actor, request.thread_id, command_id, payload.get(COMMAND_IF_MATCH_CONTEXT_KEY))


def cmd_restore_communication_thread(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    request = _lifecycle_request(payload)
    return restore_thread(db, actor, request.thread_id, command_id, payload.get(COMMAND_IF_MATCH_CONTEXT_KEY))


def _lifecycle_request(payload: dict[str, Any]) -> CommunicationThreadLifecycleRequest:
    try:
        return CommunicationThreadLifecycleRequest.model_validate({
            key: value for key, value in payload.items() if key != COMMAND_IF_MATCH_CONTEXT_KEY
        })
    except ValidationError as exc:
        raise ValueError(exc.errors()[0].get("msg", "invalid communication thread lifecycle request")) from exc


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateCommunicationThread": cmd_create_communication_thread,
        "ArchiveCommunicationThread": cmd_archive_communication_thread,
        "RestoreCommunicationThread": cmd_restore_communication_thread,
    }


def command_permissions() -> dict[str, str]:
    return {
        "CreateCommunicationThread": "communications.edit",
        "ArchiveCommunicationThread": "communications.edit",
        "RestoreCommunicationThread": "communications.edit",
    }
