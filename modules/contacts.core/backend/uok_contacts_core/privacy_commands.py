from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from uok.kernel_models import CommandLog, EventRecord
from uok.security import Actor
from uok.util import dumps, loads

from .command_support import _emit_event, _party
from .models import ContactGroupMember, ContactImportBatch, Party, PartyNote, PartyRelationship, utcnow
from .system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactDuplicateCandidate,
    ContactExternalIdentity,
    ContactImportRow,
    PartyCustomFieldValue,
    PartyFact,
)


def cmd_anonymize_contact(db: Session, actor: Actor, payload: dict, command_id: str) -> dict:
    party_id = str(payload.get("party_id") or payload.get("contact_id") or "").strip()
    party = _party(db, actor, party_id, "party_id")
    if party.status == "purged":
        return {"party_id": party.id, "status": "purged", "already_purged": True}

    identity_parties = _merged_identity_parties(db, actor, party)
    identity_ids = {row.id for row in identity_parties}
    affected_batch_ids: set[str] = set()
    for identity_party in identity_parties:
        affected_batch_ids.update(_remove_contact_owned_records(db, actor, identity_party))
    for identity_party in identity_parties:
        _scrub_import_batches(db, actor, identity_party.id, affected_batch_ids)
        _scrub_platform_audit_payloads(db, actor, identity_party.id)
    _scrub_party_references(db, actor, identity_ids)
    for identity_party in identity_parties:
        _tombstone(identity_party)
    db.flush()
    _emit_event(db, actor, "ContactPurged", "Party", party.id, {
        "tombstone": True,
        "tombstone_count": len(identity_ids),
    })
    result = {"party_id": party.id, "status": "purged", "tombstone": True}
    if len(identity_ids) > 1:
        result["related_tombstone_count"] = len(identity_ids) - 1
    return result


def _merged_identity_parties(db: Session, actor: Actor, requested: Party) -> list[Party]:
    parties = list(db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
    )).all())
    by_id = {row.id: row for row in parties}
    links: dict[str, set[str]] = {row.id: set() for row in parties}
    for row in parties:
        attrs = loads(row.attrs_json, {})
        merged_duplicate_ids = attrs.get("merged_duplicate_ids")
        if not isinstance(merged_duplicate_ids, list):
            merged_duplicate_ids = []
        related_ids = {
            str(attrs.get("merged_into_party_id") or ""),
            *[str(value) for value in merged_duplicate_ids if value],
        }
        for related_id in related_ids:
            if related_id and related_id in by_id:
                links[row.id].add(related_id)
                links[related_id].add(row.id)

    identity_ids: set[str] = set()
    pending = [requested.id]
    while pending:
        party_id = pending.pop()
        if party_id in identity_ids:
            continue
        identity_ids.add(party_id)
        pending.extend(links.get(party_id, set()) - identity_ids)
    return sorted(
        [by_id[party_id] for party_id in identity_ids if party_id in by_id],
        key=lambda row: (row.id != requested.id, row.id),
    )


def _remove_contact_owned_records(db: Session, actor: Actor, party: Party) -> set[str]:
    _delete_rows(db, PartyFact, PartyFact.organization_id == actor.organization_id, PartyFact.party_id == party.id)
    _delete_rows(db, ContactConsentRecord, ContactConsentRecord.organization_id == actor.organization_id, ContactConsentRecord.party_id == party.id)
    _delete_rows(db, PartyNote, PartyNote.organization_id == actor.organization_id, PartyNote.party_id == party.id)
    _delete_rows(db, PartyRelationship, PartyRelationship.organization_id == actor.organization_id, or_(PartyRelationship.from_party_id == party.id, PartyRelationship.to_party_id == party.id))
    _delete_rows(db, ContactGroupMember, ContactGroupMember.organization_id == actor.organization_id, ContactGroupMember.party_id == party.id)
    _delete_rows(db, PartyCustomFieldValue, PartyCustomFieldValue.organization_id == actor.organization_id, PartyCustomFieldValue.party_id == party.id)
    _delete_rows(db, ContactExternalIdentity, ContactExternalIdentity.organization_id == actor.organization_id, ContactExternalIdentity.party_id == party.id)
    _delete_rows(db, ContactActivity, ContactActivity.organization_id == actor.organization_id, ContactActivity.party_id == party.id)
    _delete_rows(db, ContactDuplicateCandidate, ContactDuplicateCandidate.organization_id == actor.organization_id, or_(ContactDuplicateCandidate.left_party_id == party.id, ContactDuplicateCandidate.right_party_id == party.id))
    import_rows = db.scalars(select(ContactImportRow).where(
        ContactImportRow.organization_id == actor.organization_id,
        or_(ContactImportRow.party_id == party.id, ContactImportRow.matched_party_id == party.id),
    )).all()
    affected_batch_ids = {row.batch_id for row in import_rows}
    import_batch_id = str(loads(party.attrs_json, {}).get("import_batch_id") or "")
    if import_batch_id:
        affected_batch_ids.add(import_batch_id)
    for row in import_rows:
        row.party_id = None
        row.matched_party_id = None
        row.checksum = f"purged:{row.id}"[:64]
        row.input_json = dumps({"purged": True})
        row.result_json = dumps({"purged": True})
        row.error_message = ""
        row.updated_at = utcnow()
    return affected_batch_ids


def _scrub_party_references(db: Session, actor: Actor, party_ids: set[str]) -> None:
    if not party_ids:
        return
    conditions = [Party.attrs_json.contains(party_id) for party_id in party_ids]
    rows = db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.id.not_in(party_ids),
        or_(*conditions),
    )).all()
    for row in rows:
        attrs = loads(row.attrs_json, {})
        removed_names = {
            str(item.get("duplicate_display_name") or "")
            for item in attrs.get("merge_history", [])
            if isinstance(item, dict)
            and ({item.get("primary_party_id"), item.get("duplicate_party_id")} & party_ids)
        }
        attrs["merge_history"] = [
            item for item in attrs.get("merge_history", [])
            if not isinstance(item, dict)
            or not ({item.get("primary_party_id"), item.get("duplicate_party_id")} & party_ids)
        ]
        attrs["duplicate_candidates"] = [
            item for item in attrs.get("duplicate_candidates", [])
            if not isinstance(item, dict) or item.get("id") not in party_ids
        ]
        attrs["merged_duplicate_ids"] = [value for value in attrs.get("merged_duplicate_ids", []) if value not in party_ids]
        attrs["merged_duplicate_names"] = [value for value in attrs.get("merged_duplicate_names", []) if value not in removed_names]
        row.attrs_json = dumps(_redact_party_ids(attrs, party_ids))
        row.updated_at = utcnow()


def _redact_party_ids(value, party_ids: set[str]):
    if isinstance(value, dict):
        return {
            key: _redact_party_ids(item, party_ids)
            for key, item in value.items()
            if not isinstance(item, str) or item not in party_ids
        }
    if isinstance(value, list):
        return [
            _redact_party_ids(item, party_ids)
            for item in value
            if not isinstance(item, str) or item not in party_ids
        ]
    return None if isinstance(value, str) and value in party_ids else value


def _tombstone(party: Party) -> None:
    party.display_name = f"Purged contact {party.id[:8]}"
    party.party_type = "person"
    party.status = "purged"
    party.review_state = "ready"
    party.owner_user_id = None
    party.team_id = None
    party.visibility_scope = "private"
    party.source = "purged"
    party.client_reference = None
    party.sync_state = "purged"
    party.attrs_json = dumps({"purged": True})
    party.archived_at = None
    party.purged_at = utcnow()
    party.updated_at = party.purged_at


def _delete_rows(db: Session, model, *criteria) -> None:
    for row in db.scalars(select(model).where(*criteria)).all():
        db.delete(row)


def _scrub_import_batches(db: Session, actor: Actor, party_id: str, affected_batch_ids: set[str]) -> None:
    batches = db.scalars(select(ContactImportBatch).where(ContactImportBatch.organization_id == actor.organization_id)).all()
    for batch in batches:
        if batch.id not in affected_batch_ids and party_id not in batch.attrs_json:
            continue
        attrs = loads(batch.attrs_json, {})
        for key in ("imported", "failures"):
            if isinstance(attrs.get(key), list):
                attrs[key] = [
                    {"purged": True, "row": item.get("row")}
                    if isinstance(item, dict) and item.get("party_id") == party_id else item
                    for item in attrs[key]
                ]
        attrs["contains_purged_contact"] = True
        batch.attrs_json = dumps(attrs)


def _scrub_platform_audit_payloads(db: Session, actor: Actor, party_id: str) -> None:
    events = db.scalars(select(EventRecord).where(
        EventRecord.organization_id == actor.organization_id,
        or_(EventRecord.object_id == party_id, EventRecord.payload_json.contains(party_id)),
    )).all()
    for event in events:
        event.payload_json = dumps({"redacted": True, "tombstone_id": party_id})
    logs = db.scalars(select(CommandLog).where(
        CommandLog.organization_id == actor.organization_id,
        or_(CommandLog.request_json.contains(party_id), CommandLog.response_json.contains(party_id)),
    )).all()
    for log in logs:
        log.request_json = dumps({"redacted": True, "tombstone_id": party_id})
        log.response_json = dumps({"redacted": True, "tombstone_id": party_id})
