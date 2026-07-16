from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.persistence.models import ContactTeam, ContactTeamMember, Party, PartyNote, PartyRelationship
from uok.kernel_models import Membership
from uok.security import Actor, has_permission


def can_manage_contacts(actor: Actor) -> bool:
    return has_permission(actor, "contacts.manage") or has_permission(actor, "contacts.restore") or has_permission(actor, "contacts.purge")


def actor_contact_team_ids(db: Session, actor: Actor) -> set[str]:
    return set(db.scalars(select(ContactTeamMember.team_id).join(
        ContactTeam,
        ContactTeam.id == ContactTeamMember.team_id,
    ).where(
        ContactTeamMember.organization_id == actor.organization_id,
        ContactTeam.organization_id == actor.organization_id,
        ContactTeamMember.user_id == actor.user_id,
        ContactTeamMember.status == "active",
        ContactTeam.status == "active",
    )).all())


def validate_contact_assignment(
    db: Session,
    actor: Actor,
    *,
    owner_user_id: str | None,
    team_id: str | None,
    visibility_scope: str,
) -> None:
    if owner_user_id and not db.scalar(select(Membership.id).where(
        Membership.organization_id == actor.organization_id,
        Membership.user_id == owner_user_id,
    )):
        raise ValueError("contact owner must belong to the current organization")
    team = db.get(ContactTeam, team_id) if team_id else None
    if team_id and (not team or team.organization_id != actor.organization_id or team.status != "active"):
        raise ValueError("contact team must be active in the current organization")
    if visibility_scope == "team" and not team_id:
        raise ValueError("team visibility requires an active contact team")


def can_read_party(actor: Actor, party: Party, team_ids: set[str] | None = None) -> bool:
    if party.status == "purged" and not has_permission(actor, "contacts.purge"):
        return False
    if not (has_permission(actor, "contacts.read") or can_manage_contacts(actor)):
        return False
    if can_manage_contacts(actor):
        return True
    if party.owner_user_id and party.owner_user_id == actor.user_id:
        return True
    if party.visibility_scope == "organization":
        return True
    return party.visibility_scope == "team" and bool(party.team_id and party.team_id in (team_ids or set()))


def readable_party_filter(actor: Actor, db: Session | None = None):
    team_ids = actor_contact_team_ids(db, actor) if db is not None else set()

    def allowed(party: Party) -> bool:
        return can_read_party(actor, party, team_ids)

    return allowed


def get_party_or_error(db: Session, actor: Actor, party_id: str) -> Party:
    party = db.get(Party, party_id)
    if not party or party.organization_id != actor.organization_id:
        raise ValueError("contact not found")
    if not readable_party_filter(actor, db)(party):
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
