from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Party, PartyNote, PartyRelationship
from uok.security import Actor, has_permission


def can_manage_contacts(actor: Actor) -> bool:
    return has_permission(actor, "contacts.manage") or has_permission(actor, "contacts.restore") or has_permission(actor, "contacts.purge")


def can_read_party(actor: Actor, party: Party) -> bool:
    if party.status == "purged" and not has_permission(actor, "contacts.purge"):
        return False
    if not (has_permission(actor, "contacts.read") or can_manage_contacts(actor)):
        return False
    if can_manage_contacts(actor):
        return True
    if party.owner_user_id and party.owner_user_id == actor.user_id:
        return True
    return party.visibility_scope == "organization"


def readable_party_filter(actor: Actor):
    def allowed(party: Party) -> bool:
        return can_read_party(actor, party)

    return allowed


def get_party_or_error(db: Session, actor: Actor, party_id: str) -> Party:
    party = db.get(Party, party_id)
    if not party or party.organization_id != actor.organization_id:
        raise ValueError("contact not found")
    if not readable_party_filter(actor)(party):
        raise PermissionError("contacts.read")
    return party


def can_read_note(actor: Actor, note: PartyNote) -> bool:
    if can_manage_contacts(actor) or note.author_user_id == actor.user_id:
        return True
    return note.visibility_scope == "organization" and has_permission(actor, "contacts.read")


def readable_note_records(db: Session, party_id: str, actor: Actor | None = None) -> list[PartyNote]:
    rows = db.scalars(select(PartyNote).where(PartyNote.party_id == party_id).order_by(PartyNote.created_at.desc())).all()
    if actor is None:
        return list(rows)
    return [row for row in rows if can_read_note(actor, row)]


def readable_relationship_records(db: Session, actor: Actor, party_id: str, allowed) -> list[PartyRelationship]:
    rows = db.scalars(select(PartyRelationship).where(
        (PartyRelationship.from_party_id == party_id) | (PartyRelationship.to_party_id == party_id)
    )).all()
    return [
        row for row in rows
        if (from_party := db.get(Party, row.from_party_id))
        and (to_party := db.get(Party, row.to_party_id))
        and allowed(from_party)
        and allowed(to_party)
    ]


def relationship_is_readable(db: Session, row: PartyRelationship, allowed) -> bool:
    from_party = db.get(Party, row.from_party_id)
    to_party = db.get(Party, row.to_party_id)
    return bool(from_party and to_party and allowed(from_party) and allowed(to_party))
