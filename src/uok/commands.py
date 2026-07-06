from __future__ import annotations

from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from .contacts import clean_text
from .contacts_commands import (
    cmd_add_contact_note,
    cmd_archive_contact,
    cmd_create_contact,
    cmd_import_contacts_csv,
    cmd_link_contact_relationship,
    cmd_purge_contact,
    cmd_restore_contact,
    cmd_update_contact,
    command_handlers,
)
from .module_ops import ensure_command_module_operational
from .models import CommandLog
from .security import Actor, require_permission
from .util import dumps, loads

COMMAND_PERMISSIONS = {
    "CreateContact": "contacts.manage",
    "UpdateContact": "contacts.manage",
    "ArchiveContact": "contacts.manage",
    "RestoreContact": "contacts.restore",
    "PurgeContact": "contacts.purge",
    "AddContactNote": "contacts.manage",
    "LinkContactRelationship": "contacts.manage",
    "ImportContactsCsv": "contacts.import",
    "VerifyBaseline": "migration.verify",
}
MAX_IDEMPOTENCY_KEY_LENGTH = 180


def _log_denied_command(db: Session, actor: Actor, command_type: str, key: str, request_json: str, exc: PermissionError) -> None:
    db.rollback()
    denied = CommandLog(
        organization_id=actor.organization_id,
        command_type=command_type,
        idempotency_key=f"{key}:denied:{uuid4()}",
        status="denied",
        request_json=request_json,
        response_json=dumps({"permission": str(exc)}),
    )
    db.add(denied)
    db.commit()


def _log_validation_error(db: Session, actor: Actor, command_type: str, key: str, payload: dict[str, Any], exc: ValueError) -> None:
    db.rollback()
    failed = CommandLog(
        organization_id=actor.organization_id,
        command_type=command_type,
        idempotency_key=f"{key}:validation:{uuid4()}",
        status="validation_error",
        request_json=dumps(payload),
        response_json=dumps({"error": str(exc)}),
    )
    db.add(failed)
    db.commit()


def _authorized_replay_or_none(db: Session, actor: Actor, command_type: str, payload: dict[str, Any], key: str, request_json: str) -> dict[str, Any] | None:
    require_permission(actor, COMMAND_PERMISSIONS[command_type])
    ensure_command_module_operational(db, actor.organization_id, command_type)
    existing = db.scalar(select(CommandLog).where(CommandLog.organization_id == actor.organization_id, CommandLog.idempotency_key == key))
    if not existing or existing.status != "succeeded":
        return None
    if existing.command_type != command_type or existing.request_json != request_json:
        raise ValueError("idempotency_key is already used for a different command request")
    return {"idempotent": True, "status": existing.status, "result": loads(existing.response_json)}


def execute_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any], idempotency_key: str | None = None) -> dict[str, Any]:
    command_type = clean_text(command_type)
    handler = command_handlers().get(command_type)
    if not handler:
        raise ValueError(f"Unknown command_type {command_type}")
    key = clean_text(idempotency_key) if idempotency_key else f"{command_type}:{uuid4()}"
    if len(key) > MAX_IDEMPOTENCY_KEY_LENGTH:
        raise ValueError(f"idempotency_key must be {MAX_IDEMPOTENCY_KEY_LENGTH} characters or fewer")
    request_json = dumps(payload)
    try:
        replay = _authorized_replay_or_none(db, actor, command_type, payload, key, request_json)
    except PermissionError as exc:
        _log_denied_command(db, actor, command_type, key, request_json, exc)
        raise
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
    db.flush()
    try:
        result = handler(db, actor, payload, log.id)
        log.status = "succeeded"
        log.response_json = dumps(result)
        db.commit()
        return {"idempotent": False, "command_id": log.id, "status": "succeeded", "result": result}
    except ValueError as exc:
        _log_validation_error(db, actor, command_type, key, payload, exc)
        raise


__all__ = [
    "COMMAND_PERMISSIONS",
    "MAX_IDEMPOTENCY_KEY_LENGTH",
    "cmd_add_contact_note",
    "cmd_archive_contact",
    "cmd_create_contact",
    "cmd_import_contacts_csv",
    "cmd_link_contact_relationship",
    "cmd_purge_contact",
    "cmd_restore_contact",
    "cmd_update_contact",
    "command_handlers",
    "execute_command",
]
