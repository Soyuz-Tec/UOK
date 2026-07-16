from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import dumps

from .audit import emit_communication_event
from .concurrency import communication_thread_etag
from .models import CommunicationThread, utcnow
from .schemas import CommunicationThreadCreateRequest


def create_thread(db: Session, actor: Actor, request: CommunicationThreadCreateRequest, command_id: str) -> dict[str, Any]:
    now = utcnow()
    row = CommunicationThread(
        organization_id=actor.organization_id,
        title=request.title.strip(),
        context_type=request.context_type,
        context_id=request.context_id,
        attrs_json=dumps({"source_command_id": command_id}),
        created_by_user_id=actor.user_id,
        created_at=now,
        updated_at=now,
    )
    db.add(row)
    db.flush()
    emit_communication_event(db, actor, "CommunicationThreadCreated", row.id, {
        "thread_id": row.id,
        "context_type": row.context_type,
        "context_id": row.context_id,
        "correlation_id": command_id,
    })
    return serialize_thread(row, command_id)


def list_threads(db: Session, actor: Actor, lifecycle: str = "active") -> list[dict[str, Any]]:
    stmt = select(CommunicationThread).where(CommunicationThread.organization_id == actor.organization_id)
    if lifecycle == "active":
        stmt = stmt.where(CommunicationThread.status != "archived")
    elif lifecycle == "archived":
        stmt = stmt.where(CommunicationThread.status == "archived")
    elif lifecycle != "all":
        raise ValueError("communication thread lifecycle must be active, archived, or all")
    rows = db.scalars(stmt.order_by(CommunicationThread.updated_at.desc(), CommunicationThread.id)).all()
    return [serialize_thread(row) for row in rows]


def thread_or_error(db: Session, actor: Actor, thread_id: str, *, include_archived: bool = False) -> CommunicationThread:
    row = db.scalar(select(CommunicationThread).where(
        CommunicationThread.id == thread_id,
        CommunicationThread.organization_id == actor.organization_id,
    ))
    if row is None or (row.status == "archived" and not include_archived):
        raise ValueError("communication thread not found")
    return row


def serialize_thread(row: CommunicationThread, correlation_id: str | None = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title,
        "status": row.status,
        "restore_status": row.archived_from_status,
        "revision": row.revision,
        "etag": communication_thread_etag(row),
        "context_type": row.context_type,
        "context_id": row.context_id,
        "created_by_user_id": row.created_by_user_id,
        "created_at": _timestamp(row.created_at),
        "updated_at": _timestamp(row.updated_at),
        **({"correlation_id": correlation_id} if correlation_id else {}),
    }


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None or value.utcoffset() is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()
