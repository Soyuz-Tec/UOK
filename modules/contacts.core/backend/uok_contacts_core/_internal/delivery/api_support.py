from __future__ import annotations

from typing import Any
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy.orm import Session

from uok.commands import execute_command
from uok.module_ops import ensure_module_operational
from uok.security import Actor


def run_contact_command(db: Session, actor: Actor, command_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    try:
        return execute_command(db, actor, command_type, payload, f"{command_type}:{uuid4()}")["result"]
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=f"Permission denied: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc


def require_contacts_module_operational(db: Session, actor: Actor) -> None:
    try:
        ensure_module_operational(db, actor.organization_id, "contacts.core")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
