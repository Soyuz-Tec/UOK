from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .command_context import COMMAND_ETAG_RESULT_KEY, COMMAND_IF_MATCH_CONTEXT_KEY, CommandDomainError, CommandPermissionError, CommandPreconditionError
from .host.module_commands import assert_command_replay_visible, command_permissions, load_module_command_handlers
from .kernel_models import CommandLog
from .module_ops import ensure_command_module_operational
from .security import Actor, require_permission
from .util import dumps, loads

COMMAND_PERMISSIONS = command_permissions()
MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH = 16
MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH = 128
MAX_IDEMPOTENCY_KEY_LENGTH = 180


class IdempotencyConflictError(CommandDomainError):
    """Raised when one idempotency key is reused for different command content."""

    def __init__(self, correlation_id: str | None = None, object_ids: list[str] | None = None) -> None:
        super().__init__(
            code="idempotency_conflict",
            message="idempotency_key is already used for a different command request",
            status_code=409,
            field="idempotency_key",
            object_ids=object_ids,
            repair="Retry the original payload with this key, or use a new key for a different intent.",
            correlation_id=correlation_id,
        )


def clean_command_text(value: Any) -> str:
    return str(value or "").strip()


def command_handlers():
    return load_module_command_handlers()


def _log_denied_command(db: Session, actor: Actor, command_type: str, key: str, request_json: str, payload: dict[str, Any], exc: PermissionError) -> CommandPermissionError:
    db.rollback()
    denied_id = str(uuid4())
    error = CommandPermissionError(str(exc), denied_id, _command_object_ids(payload))
    denied = CommandLog(
        id=denied_id,
        organization_id=actor.organization_id,
        command_type=command_type,
        idempotency_key=f"{key}:denied:{uuid4()}",
        status="denied",
        request_json=request_json,
        response_json=dumps(error.response_body()),
    )
    db.add(denied)
    db.commit()
    return error


def _log_validation_error(db: Session, actor: Actor, command_type: str, key: str, payload: dict[str, Any], exc: ValueError, command_id: str | None = None) -> None:
    db.rollback()
    if command_id and hasattr(exc, "correlation_id") and getattr(exc, "attach_correlation", True):
        exc.correlation_id = command_id
    error_response = exc.response_body() if isinstance(exc, (CommandDomainError, CommandPreconditionError)) else {"error": str(exc)}
    failed = CommandLog(
        **({"id": command_id} if command_id else {}),
        organization_id=actor.organization_id,
        command_type=command_type,
        idempotency_key=f"{key}:validation:{uuid4()}",
        status="validation_error",
        request_json=dumps(payload),
        response_json=dumps(error_response),
    )
    db.add(failed)
    db.commit()


def _authorized_replay_or_none(db: Session, actor: Actor, command_type: str, payload: dict[str, Any], key: str, request_json: str) -> dict[str, Any] | None:
    require_permission(actor, command_permissions()[command_type])
    ensure_command_module_operational(db, actor.organization_id, command_type)
    existing = db.scalar(select(CommandLog).where(CommandLog.organization_id == actor.organization_id, CommandLog.idempotency_key == key))
    if not existing or existing.status != "succeeded":
        return None
    if existing.command_type != command_type or existing.request_json != request_json:
        raise IdempotencyConflictError(existing.id, _command_object_ids(payload))
    result = loads(existing.response_json)
    assert_command_replay_visible(
        db, actor, existing.command_type, loads(existing.request_json), result, existing.id,
    )
    return {"idempotent": True, "status": existing.status, "result": result}


def execute_command(
    db: Session,
    actor: Actor,
    command_type: str,
    payload: dict[str, Any],
    idempotency_key: str | None = None,
    if_match: str | None = None,
) -> dict[str, Any]:
    command_type = clean_command_text(command_type)
    handler = command_handlers().get(command_type)
    if not handler:
        raise ValueError(f"Unknown command_type {command_type}")
    key = clean_command_text(idempotency_key) if idempotency_key else f"{command_type}:{uuid4()}"
    if len(key) > MAX_IDEMPOTENCY_KEY_LENGTH:
        raise ValueError(f"idempotency_key must be {MAX_IDEMPOTENCY_KEY_LENGTH} characters or fewer")
    request_json = dumps(payload)
    try:
        replay = _authorized_replay_or_none(db, actor, command_type, payload, key, request_json)
    except PermissionError as exc:
        raise _log_denied_command(db, actor, command_type, key, request_json, payload, exc) from exc
    if replay is not None:
        return replay

    log = CommandLog(
        organization_id=actor.organization_id,
        command_type=command_type,
        idempotency_key=key,
        status="received",
        request_json=request_json,
    )
    db.add(log)
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        replay = _authorized_replay_or_none(db, actor, command_type, payload, key, request_json)
        if replay is not None:
            return replay
        raise
    try:
        execution_payload = {**payload, COMMAND_IF_MATCH_CONTEXT_KEY: if_match}
        result = handler(db, actor, execution_payload, log.id)
        log.status = "succeeded"
        log.response_json = dumps(result)
        db.commit()
        return {"idempotent": False, "command_id": log.id, "status": "succeeded", "result": result}
    except ValueError as exc:
        _log_validation_error(db, actor, command_type, key, payload, exc, log.id)
        raise


def _command_object_ids(payload: dict[str, Any]) -> list[str]:
    return [
        str(value)
        for name, value in payload.items()
        if (name == "id" or name.endswith("_id")) and value not in (None, "")
    ]


__all__ = [
    "COMMAND_ETAG_RESULT_KEY",
    "COMMAND_IF_MATCH_CONTEXT_KEY",
    "COMMAND_PERMISSIONS",
    "CommandPreconditionError",
    "CommandPermissionError",
    "CommandDomainError",
    "IdempotencyConflictError",
    "MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH",
    "MAX_IDEMPOTENCY_KEY_LENGTH",
    "MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH",
    "clean_command_text",
    "command_handlers",
    "execute_command",
]
