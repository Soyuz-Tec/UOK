from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .command_support import CommandHandler, _emit_event, _link_company_payload, _party
from .facade import (
    bounded_text,
    choose_display_name,
    choose_party_type,
    contact_attrs,
    contact_visibility_scope,
    find_duplicate_candidates,
    has_meaningful_contact_value,
    note_visibility_scope,
    readable_note_records,
    readable_party_filter,
    readable_relationship_records,
    review_state_for_payload,
    serialize_party,
    touch_party,
    validate_contact_payload_lengths,
)
from .models import PartyNote, PartyRelationship, utcnow
from .profile_service import apply_profile_write, record_profile_evidence, rebuild_business_profile
from uok.security import Actor
from uok.util import dumps, loads


def cmd_create_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    from .command_support import _create_party

    party, duplicate_candidates = _create_party(db, actor, payload, "manual")
    company_party_id = _link_company_payload(db, actor, party, payload)
    _emit_event(db, actor, "ContactCreated", "Party", party.id, {
        "display_name": party.display_name,
        "party_type": party.party_type,
        "review_state": party.review_state,
        "duplicate_candidates": duplicate_candidates,
    })
    result = serialize_party(db, party, include_detail=True, actor=actor)
    result["contact_id"] = party.id
    result["company_party_id"] = company_party_id
    return result


def cmd_update_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot be edited")
    attrs = loads(party.attrs_json, {})
    for field, value in contact_attrs(payload).items():
        attrs[field] = value
    if "party_type" in payload:
        party.party_type = choose_party_type(payload)
    if any(field in payload for field in ("display_name", "given_name", "family_name", "organization_name", "email", "phone", "website", "address", "note")):
        merged_payload = {**attrs, **payload, "display_name": payload.get("display_name", party.display_name)}
        if not has_meaningful_contact_value(merged_payload):
            raise ValueError("at least one meaningful contact field is required")
        party.display_name = choose_display_name(merged_payload)
    duplicate_candidates = find_duplicate_candidates(db, actor, {**attrs, "display_name": party.display_name, "party_type": party.party_type}, party.id)
    attrs["duplicate_candidates"] = duplicate_candidates
    party.review_state = review_state_for_payload({**attrs, **payload, "display_name": party.display_name}, duplicate_candidates)
    if "owner_user_id" in payload:
        party.owner_user_id = bounded_text(payload.get("owner_user_id"), "owner_user_id") or None
    if "team_id" in payload:
        party.team_id = bounded_text(payload.get("team_id"), "team_id") or None
    if "visibility_scope" in payload:
        party.visibility_scope = contact_visibility_scope(payload.get("visibility_scope"))
    party.attrs_json = dumps(attrs)
    touch_party(party)
    _emit_event(db, actor, "ContactUpdated", "Party", party.id, {"display_name": party.display_name, "review_state": party.review_state})
    return serialize_party(db, party, include_detail=True, actor=actor)


def cmd_archive_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot be archived")
    party.status = "archived"
    party.archived_at = utcnow()
    touch_party(party)
    _emit_event(db, actor, "ContactArchived", "Party", party.id, {"display_name": party.display_name})
    return serialize_party(db, party, include_detail=True, actor=actor)


def cmd_restore_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot be restored")
    party.status = "active"
    party.archived_at = None
    touch_party(party)
    _emit_event(db, actor, "ContactRestored", "Party", party.id, {"display_name": party.display_name})
    return serialize_party(db, party, include_detail=True, actor=actor)


def cmd_purge_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    party.status = "purged"
    party.purged_at = utcnow()
    touch_party(party)
    _emit_event(db, actor, "ContactPurged", "Party", party.id, {"display_name": party.display_name})
    return serialize_party(db, party, include_detail=True, actor=actor)


def cmd_add_contact_note(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    body = bounded_text(payload.get("body") or payload.get("note"), "body")
    if not body:
        raise ValueError("note body is required")
    note = PartyNote(
        organization_id=actor.organization_id,
        party_id=party.id,
        author_user_id=actor.user_id,
        body=body,
        visibility_scope=note_visibility_scope(payload.get("visibility_scope")),
    )
    db.add(note)
    touch_party(party)
    db.flush()
    _emit_event(db, actor, "ContactNoteAdded", "PartyNote", note.id, {"party_id": party.id})
    return {"note_id": note.id, "party": serialize_party(db, party, include_detail=True, actor=actor)}


def cmd_link_contact_relationship(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    validate_contact_payload_lengths(payload)
    from_party = _party(db, actor, bounded_text(payload.get("from_party_id"), "party_id"), "from_party_id")
    to_party = _party(db, actor, bounded_text(payload.get("to_party_id"), "party_id"), "to_party_id")
    relationship_type = bounded_text(payload.get("relationship_type"), "relationship_type")
    if not relationship_type:
        raise ValueError("relationship_type is required")
    rel = PartyRelationship(
        organization_id=actor.organization_id,
        from_party_id=from_party.id,
        to_party_id=to_party.id,
        relationship_type=relationship_type,
        attrs_json=dumps({"description": bounded_text(payload.get("description"), "description")}),
        created_at=utcnow(),
    )
    db.add(rel)
    touch_party(from_party)
    touch_party(to_party)
    db.flush()
    _emit_event(db, actor, "ContactRelationshipLinked", "PartyRelationship", rel.id, {
        "from_party_id": from_party.id,
        "to_party_id": to_party.id,
        "relationship_type": relationship_type,
    })
    return {"relationship_id": rel.id, "from_party": serialize_party(db, from_party), "to_party": serialize_party(db, to_party)}


def cmd_import_contacts_csv(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    from .import_commands import cmd_import_contacts_csv as import_handler

    return import_handler(db, actor, payload, command_id)


def cmd_update_contact_profile(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _profile_party(db, actor, payload)
    result = apply_profile_write(party, _profile_payload(payload))
    touch_party(party)
    _emit_event(db, actor, "ContactProfileUpdated", "Party", party.id, {
        "display_name": party.display_name,
        "profile_health": result.get("scores", {}).get("profile_health"),
        "confidence": result.get("confidence"),
    })
    return result


def cmd_record_contact_profile_evidence(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _profile_party(db, actor, payload)
    result = record_profile_evidence(party, _profile_payload(payload))
    touch_party(party)
    _emit_event(db, actor, "ContactProfileEvidenceRecorded", "Party", party.id, {
        "display_name": party.display_name,
        "evidence_count": result.get("evidence_count"),
        "confidence": result.get("profile", {}).get("confidence"),
    })
    return result


def cmd_rebuild_contact_profile(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _profile_party(db, actor, payload)
    allowed = readable_party_filter(actor)
    notes = readable_note_records(db, party.id, actor)
    relationships = readable_relationship_records(db, actor, party.id, allowed)
    result = rebuild_business_profile(party, _profile_payload(payload), notes=list(notes), relationships=list(relationships))
    touch_party(party)
    _emit_event(db, actor, "ContactProfileRebuilt", "Party", party.id, {
        "display_name": party.display_name,
        "profile_health": result.get("scores", {}).get("profile_health"),
        "confidence": result.get("confidence"),
    })
    return result


def _profile_party(db: Session, actor: Actor, payload: dict[str, Any]):
    party = _party(db, actor, bounded_text(payload.get("party_id") or payload.get("contact_id"), "party_id"), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot be profiled")
    return party


def _profile_payload(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if key not in {"party_id", "contact_id"}}


def command_handlers() -> dict[str, CommandHandler]:
    return {
        "CreateContact": cmd_create_contact,
        "UpdateContact": cmd_update_contact,
        "ArchiveContact": cmd_archive_contact,
        "RestoreContact": cmd_restore_contact,
        "PurgeContact": cmd_purge_contact,
        "AddContactNote": cmd_add_contact_note,
        "LinkContactRelationship": cmd_link_contact_relationship,
        "ImportContactsCsv": cmd_import_contacts_csv,
        "UpdateContactProfile": cmd_update_contact_profile,
        "RecordContactProfileEvidence": cmd_record_contact_profile_evidence,
        "RebuildContactProfile": cmd_rebuild_contact_profile,
    }


def command_permissions() -> dict[str, str]:
    return {
        "CreateContact": "contacts.manage",
        "UpdateContact": "contacts.manage",
        "ArchiveContact": "contacts.manage",
        "RestoreContact": "contacts.restore",
        "PurgeContact": "contacts.purge",
        "AddContactNote": "contacts.manage",
        "LinkContactRelationship": "contacts.manage",
        "ImportContactsCsv": "contacts.import",
        "UpdateContactProfile": "contacts.manage",
        "RecordContactProfileEvidence": "contacts.manage",
        "RebuildContactProfile": "contacts.manage",
    }
