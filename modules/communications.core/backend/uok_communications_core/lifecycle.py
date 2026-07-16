from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor

from .audit import emit_communication_event
from .concurrency import communication_thread_etag, require_thread_precondition
from .models import CommunicationThread, utcnow
from .service import serialize_thread

RESTORABLE_STATUSES = {"open", "closed"}


def archive_thread(db: Session, actor: Actor, thread_id: str, command_id: str, if_match: str | None) -> dict[str, Any]:
    row = _locked_thread_or_error(db, actor, thread_id)
    require_thread_precondition(row, if_match)
    if row.status == "archived":
        return {**serialize_thread(row, command_id), "_uok_response_etag": communication_thread_etag(row)}
    if row.status not in RESTORABLE_STATUSES:
        raise ValueError("communication thread cannot be archived from its current status")

    previous_status = row.status
    now = utcnow()
    row.status = "archived"
    row.archived_from_status = previous_status
    row.archived_at = now
    row.updated_at = now
    row.revision += 1
    db.flush()
    emit_communication_event(db, actor, "CommunicationThreadArchived", row.id, {
        "thread_id": row.id,
        "previous_status": previous_status,
        "correlation_id": command_id,
    })
    return {**serialize_thread(row, command_id), "_uok_response_etag": communication_thread_etag(row)}


def restore_thread(db: Session, actor: Actor, thread_id: str, command_id: str, if_match: str | None) -> dict[str, Any]:
    row = _locked_thread_or_error(db, actor, thread_id)
    require_thread_precondition(row, if_match)
    if row.status != "archived":
        return {**serialize_thread(row, command_id), "_uok_response_etag": communication_thread_etag(row)}

    restored_status = row.archived_from_status
    if restored_status not in RESTORABLE_STATUSES:
        raise ValueError("communication thread has no valid pre-archive status")
    now = utcnow()
    row.status = restored_status
    row.archived_from_status = None
    row.archived_at = None
    row.updated_at = now
    row.revision += 1
    db.flush()
    emit_communication_event(db, actor, "CommunicationThreadRestored", row.id, {
        "thread_id": row.id,
        "restored_status": restored_status,
        "correlation_id": command_id,
    })
    return {**serialize_thread(row, command_id), "_uok_response_etag": communication_thread_etag(row)}


def _locked_thread_or_error(db: Session, actor: Actor, thread_id: str) -> CommunicationThread:
    row = db.scalar(
        select(CommunicationThread)
        .where(
            CommunicationThread.id == thread_id,
            CommunicationThread.organization_id == actor.organization_id,
        )
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if row is None:
        raise ValueError("communication thread not found")
    return row


__all__ = ["archive_thread", "restore_thread"]
