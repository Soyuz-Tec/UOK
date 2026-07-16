from __future__ import annotations

import re
from typing import Any, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.facade import (
    bounded_text,
    choose_display_name,
    choose_party_type,
    clean_text,
    contact_attrs,
    contact_visibility_scope,
    find_duplicate_candidates,
    has_meaningful_contact_value,
    review_state_for_payload,
    validate_contact_assignment,
    validate_contact_payload_lengths,
)
from uok_contacts_core._internal.persistence.models import Party, PartyNote, PartyRelationship, utcnow
from uok_contacts_core._internal.persistence.system_models import ContactActivity
from uok.module_events import emit_module_event
from uok.security import Actor
from uok.util import dumps

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]


def _emit_event(db: Session, actor: Actor, event_type: str, object_type: str, object_id: str, payload: dict[str, Any]) -> None:
    emit_module_event(db, actor, event_type, object_type, object_id, payload)
    _record_contact_event_activity(db, actor, event_type, object_type, object_id, payload)


def _record_contact_event_activity(db: Session, actor: Actor, event_type: str, object_type: str, object_id: str, payload: dict[str, Any]) -> None:
    if event_type in {
        "ContactConsentRecorded",
        "ContactCustomFieldValueSet",
        "ContactExternalIdentityLinked",
        "ContactFactRemoved",
        "ContactFactSaved",
        "ContactsBulkUpdated",
    }:
        return
    party_ids: set[str] = set()
    if object_type == "Party":
        party_ids.add(object_id)
    for key, value in payload.items():
        if key == "party_id" or key.endswith("_party_id"):
            if isinstance(value, str) and value:
                party_ids.add(value)
    safe_payload = {
        key: value for key, value in payload.items()
        if not any(sensitive in key.lower() for sensitive in ("address", "display_name", "email", "name", "note", "phone"))
    }
    summary = re.sub(r"(?<!^)(?=[A-Z])", " ", event_type).strip()
    for party_id in party_ids:
        party = db.get(Party, party_id)
        if not party or party.organization_id != actor.organization_id:
            continue
        db.add(ContactActivity(
            organization_id=actor.organization_id,
            party_id=party_id,
            actor_user_id=actor.user_id,
            activity_type=event_type,
            object_type=object_type,
            object_id=object_id,
            summary=summary[:240],
            payload_json=dumps(safe_payload),
            occurred_at=utcnow(),
        ))


def _party(db: Session, actor: Actor, party_id: str, field: str, allowed_types: set[str] | None = None) -> Party:
    party = db.get(Party, party_id)
    if not party or party.organization_id != actor.organization_id:
        raise ValueError(f"{field} not found")
    if allowed_types and party.party_type not in allowed_types:
        raise ValueError(f"{field} must be one of: {', '.join(sorted(allowed_types))}")
    return party


def _organization(db: Session, actor: Actor, name: str, source: str) -> Party:
    existing = db.scalar(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.party_type == "organization",
        Party.display_name == name,
        Party.status != "purged",
    ))
    if existing:
        return existing
    now = utcnow()
    party = Party(
        organization_id=actor.organization_id,
        party_type="organization",
        display_name=name,
        review_state="ready",
        owner_user_id=actor.user_id,
        source=source,
        attrs_json=dumps({"organization_name": name}),
        created_at=now,
        updated_at=now,
    )
    db.add(party)
    db.flush()
    _emit_event(db, actor, "ContactOrganizationCreated", "Party", party.id, {"display_name": name})
    return party


def _create_party(db: Session, actor: Actor, payload: dict[str, Any], source: str = "manual") -> tuple[Party, list[dict[str, str]]]:
    validate_contact_payload_lengths(payload)
    if not has_meaningful_contact_value(payload):
        raise ValueError("at least one meaningful contact field is required")
    duplicate_candidates = find_duplicate_candidates(db, actor, payload)
    attrs = contact_attrs(payload)
    if clean_text(payload.get("note")):
        attrs["initial_note_preview"] = bounded_text(payload.get("note"), "note")[:120]
    if duplicate_candidates:
        attrs["duplicate_candidates"] = duplicate_candidates
    if bounded_text(payload.get("import_batch_id"), "import_batch_id"):
        attrs["import_batch_id"] = bounded_text(payload.get("import_batch_id"), "import_batch_id")
    now = utcnow()
    owner_user_id = bounded_text(payload.get("owner_user_id"), "owner_user_id") or actor.user_id
    team_id = bounded_text(payload.get("team_id"), "team_id") or None
    visibility_scope = contact_visibility_scope(payload.get("visibility_scope"))
    validate_contact_assignment(
        db,
        actor,
        owner_user_id=owner_user_id,
        team_id=team_id,
        visibility_scope=visibility_scope,
    )
    party = Party(
        organization_id=actor.organization_id,
        party_type=choose_party_type(payload),
        display_name=choose_display_name(payload),
        status="active",
        review_state=review_state_for_payload(payload, duplicate_candidates),
        owner_user_id=owner_user_id,
        team_id=team_id,
        visibility_scope=visibility_scope,
        source=bounded_text(payload.get("source"), "source") or source,
        client_reference=bounded_text(payload.get("client_reference"), "client_reference") or None,
        sync_state=bounded_text(payload.get("sync_state"), "sync_state") or "server",
        attrs_json=dumps(attrs),
        created_at=now,
        updated_at=now,
    )
    db.add(party)
    db.flush()
    if clean_text(payload.get("note")):
        db.add(PartyNote(
            organization_id=actor.organization_id,
            party_id=party.id,
            author_user_id=actor.user_id,
            body=bounded_text(payload.get("note"), "note"),
        ))
    return party, duplicate_candidates


def _link_company_payload(db: Session, actor: Actor, party: Party, payload: dict[str, Any]) -> str | None:
    if party.party_type != "person":
        return None
    company: Party | None = None
    if payload.get("company_party_id"):
        company = _party(db, actor, bounded_text(payload["company_party_id"], "company_party_id"), "company_party_id", {"organization"})
    elif bounded_text(payload.get("company_name"), "company_name"):
        company = _organization(db, actor, bounded_text(payload.get("company_name"), "company_name"), "contacts")
    if not company:
        return None
    rel = PartyRelationship(
        organization_id=actor.organization_id,
        from_party_id=party.id,
        to_party_id=company.id,
        relationship_type="works_for",
        attrs_json=dumps({"title": bounded_text(payload.get("title"), "title"), "email": bounded_text(payload.get("email"), "email")}),
        created_at=utcnow(),
    )
    db.add(rel)
    db.flush()
    _emit_event(db, actor, "ContactLinkedToOrganization", "PartyRelationship", rel.id, {"contact_id": party.id, "organization_id": company.id})
    return company.id
