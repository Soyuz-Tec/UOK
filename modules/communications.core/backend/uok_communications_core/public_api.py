from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor, has_permission

from .models import CommunicationThread as _CommunicationThread

ReferenceStatus = Literal["ready", "unavailable", "denied", "missing"]


@dataclass(frozen=True)
class CommunicationThreadReferenceResolution:
    status: ReferenceStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_communication_thread_reference(
    db: Session,
    actor: Actor,
    thread_id: str,
) -> CommunicationThreadReferenceResolution:
    """Resolve a thread reference without exposing the Communications ORM mapping."""
    if not has_permission(actor, "communications.read"):
        return CommunicationThreadReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    row = db.scalar(select(_CommunicationThread).where(
        _CommunicationThread.id == thread_id,
        _CommunicationThread.organization_id == actor.organization_id,
    ))
    if row is None:
        return CommunicationThreadReferenceResolution(
            "missing",
            None,
            "The communication thread does not exist in this organization.",
        )
    if row.archived_at is not None or row.status == "archived":
        return CommunicationThreadReferenceResolution(
            "unavailable",
            row.title,
            "Communication thread is archived.",
        )
    return CommunicationThreadReferenceResolution(
        "ready",
        row.title,
        f"Communication thread is {row.status}.",
        f"/?view=communications&thread_id={row.id}",
    )


__all__ = ["CommunicationThreadReferenceResolution", "resolve_communication_thread_reference"]
