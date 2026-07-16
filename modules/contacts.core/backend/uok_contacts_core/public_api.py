from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor, has_permission

from .access import can_read_party
from .models import Party as _Party

ReferenceStatus = Literal["ready", "unavailable", "denied", "missing"]


@dataclass(frozen=True)
class PartyReferenceResolution:
    status: ReferenceStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


def resolve_party_reference(db: Session, actor: Actor, party_id: str) -> PartyReferenceResolution:
    """Resolve a Party reference without exposing the Contacts ORM mapping."""
    if not has_permission(actor, "contacts.read"):
        return PartyReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    row = db.scalar(select(_Party).where(
        _Party.id == party_id,
        _Party.organization_id == actor.organization_id,
    ))
    if row is None:
        return PartyReferenceResolution("missing", None, "The party target does not exist in this organization.")
    if not can_read_party(actor, row):
        return PartyReferenceResolution("denied", None, "The linked target is not visible to this actor.")
    if row.purged_at is not None or row.status != "active":
        return PartyReferenceResolution("unavailable", row.display_name, f"Party is {row.status}.")
    return PartyReferenceResolution(
        "ready",
        row.display_name,
        f"Party is {row.status}.",
        f"/?view=contacts&party_id={row.id}",
    )


__all__ = ["PartyReferenceResolution", "resolve_party_reference"]
