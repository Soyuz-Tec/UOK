from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from hmac import compare_digest
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from .facade import CONTACT_ATTR_FIELDS
from .models import ContactGroupMember, Party, PartyNote, PartyRelationship, utcnow
from .system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactDuplicateCandidate,
    ContactExternalIdentity,
    ContactImportRow,
    PartyCustomFieldValue,
    PartyFact,
)
from uok.kernel_models import EventRecord
from uok.module_events import emit_module_event
from uok.security import Actor
from uok.util import dumps, loads

PRIVATE_MERGE_SNAPSHOT_EVENT = "ContactDuplicateMergeRollbackSnapshot"
MERGE_ROLLBACK_EVENT = "ContactDuplicateMergeRolledBack"


def store_merge_snapshot(
    db: Session,
    actor: Actor,
    primary: Party,
    duplicate: Party,
    snapshot: dict[str, Any],
) -> None:
    private_snapshot = {
        **snapshot,
        "post_merge_fingerprint": merge_state_fingerprint(db, actor, primary, duplicate, snapshot),
    }
    emit_module_event(
        db,
        actor,
        PRIVATE_MERGE_SNAPSHOT_EVENT,
        "ContactDuplicateMerge",
        primary.id,
        {"private_snapshot": private_snapshot},
    )


def merge_snapshot(
    db: Session,
    actor: Actor,
    primary_id: str,
    duplicate_id: str,
    merge_id: str,
) -> dict[str, Any] | None:
    events = db.scalars(
        select(EventRecord)
        .where(
            EventRecord.organization_id == actor.organization_id,
            EventRecord.event_type == PRIVATE_MERGE_SNAPSHOT_EVENT,
            EventRecord.object_id == primary_id,
        )
        .order_by(EventRecord.sequence.desc())
        .with_for_update()
    ).all()
    for event in events:
        item = loads(event.payload_json, {}).get("private_snapshot")
        if not isinstance(item, dict):
            continue
        if item.get("primary_party_id") != primary_id or item.get("duplicate_party_id") != duplicate_id:
            continue
        if merge_id and item.get("merge_id") != merge_id:
            continue
        if _was_rolled_back(db, actor, primary_id, duplicate_id, str(item.get("merge_id") or "")):
            continue
        return item
    return None


def assert_merge_state_unchanged(
    db: Session,
    actor: Actor,
    primary: Party,
    duplicate: Party,
    snapshot: dict[str, Any],
) -> None:
    expected = str(snapshot.get("post_merge_fingerprint") or "")
    current = merge_state_fingerprint(db, actor, primary, duplicate, snapshot)
    if not expected or not compare_digest(expected, current):
        raise ValueError("contacts changed since merge; rollback would overwrite intervening edits")


def merge_state_fingerprint(
    db: Session,
    actor: Actor,
    primary: Party,
    duplicate: Party,
    snapshot: dict[str, Any],
) -> str:
    governed_models = {
        "activities": ContactActivity,
        "consents": ContactConsentRecord,
        "custom_values": PartyCustomFieldValue,
        "external_identities": ContactExternalIdentity,
        "facts": PartyFact,
        "import_rows": ContactImportRow,
    }
    governed = snapshot.get("governed_records") or {}
    candidates = db.scalars(select(ContactDuplicateCandidate).where(
        ContactDuplicateCandidate.organization_id == actor.organization_id,
        or_(
            (ContactDuplicateCandidate.left_party_id == primary.id)
            & (ContactDuplicateCandidate.right_party_id == duplicate.id),
            (ContactDuplicateCandidate.left_party_id == duplicate.id)
            & (ContactDuplicateCandidate.right_party_id == primary.id),
        ),
    )).all()
    state = {
        "primary": _row_state(primary),
        "duplicate": _row_state(duplicate),
        "notes": _tracked_rows(db, PartyNote, snapshot.get("notes", [])),
        "groups": _tracked_rows(db, ContactGroupMember, snapshot.get("groups", [])),
        "relationships": _tracked_rows(db, PartyRelationship, snapshot.get("relationships", [])),
        "governed_records": {
            key: _tracked_rows(db, model, governed.get(key, []))
            for key, model in governed_models.items()
        },
        "candidates": [_row_state(row) for row in sorted(candidates, key=lambda row: row.id)],
    }
    return sha256(dumps(state).encode("utf-8")).hexdigest()


def _was_rolled_back(
    db: Session,
    actor: Actor,
    primary_id: str,
    duplicate_id: str,
    merge_id: str,
) -> bool:
    events = db.scalars(select(EventRecord).where(
        EventRecord.organization_id == actor.organization_id,
        EventRecord.event_type == MERGE_ROLLBACK_EVENT,
        EventRecord.object_id == primary_id,
    )).all()
    return any(
        payload.get("duplicate_party_id") == duplicate_id and payload.get("merge_id") == merge_id
        for payload in (loads(event.payload_json, {}) for event in events)
    )


def _tracked_rows(db: Session, model: type, items: list[dict[str, Any]]) -> list[dict[str, Any] | None]:
    return [_row_state(db.get(model, item.get("id"))) for item in items]


def _row_state(row: Any) -> dict[str, Any] | None:
    if row is None:
        return None
    state: dict[str, Any] = {}
    for column in row.__table__.columns:
        value = getattr(row, column.name)
        if column.name.endswith("_json"):
            try:
                value = loads(value, {})
            except (TypeError, ValueError):
                pass
        elif isinstance(value, datetime):
            if value.tzinfo is not None:
                value = value.astimezone(timezone.utc).replace(tzinfo=None)
            value = value.isoformat()
        state[column.name] = value
    return state


def restore_primary_merge_attrs(attrs: dict[str, Any], snapshot: dict[str, Any]) -> None:
    before = snapshot.get("primary_attrs_before") or {}
    for field in CONTACT_ATTR_FIELDS:
        if field in before:
            attrs[field] = before[field]
        else:
            attrs.pop(field, None)
    duplicate_id = snapshot.get("duplicate_party_id")
    attrs["merged_duplicate_ids"] = [
        value for value in list(attrs.get("merged_duplicate_ids") or [])
        if value != duplicate_id
    ]
    attrs["merged_duplicate_names"] = [
        value for value in list(attrs.get("merged_duplicate_names") or [])
        if value != snapshot.get("duplicate_display_name")
    ]


def mark_snapshot_rolled_back(attrs: dict[str, Any], snapshot: dict[str, Any]) -> None:
    for item in list(attrs.get("merge_history") or []):
        if isinstance(item, dict) and item.get("merge_id") == snapshot.get("merge_id"):
            item["rolled_back_at"] = iso_or_none(utcnow())


def group_snapshot(row: ContactGroupMember) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "group_id": row.group_id,
        "party_id": row.party_id,
        "added_by_user_id": row.added_by_user_id,
        "attrs_json": row.attrs_json,
        "created_at": iso_or_none(row.created_at),
    }


def relationship_snapshot(row: PartyRelationship) -> dict[str, Any]:
    return {
        "id": row.id,
        "organization_id": row.organization_id,
        "from_party_id": row.from_party_id,
        "to_party_id": row.to_party_id,
        "relationship_type": row.relationship_type,
        "attrs_json": row.attrs_json,
        "created_at": iso_or_none(row.created_at),
    }


def datetime_or_none(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value))


def iso_or_none(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def unique_texts(values: list[Any]) -> list[str]:
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if text and text not in result:
            result.append(text)
    return result
