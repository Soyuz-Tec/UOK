from __future__ import annotations

from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.delivery.command_support import _emit_event, _party
from uok_contacts_core._internal.exchange_quality.duplicate_merge_support import (
    field_choices,
    merged_attrs,
    move_group_memberships,
    move_governed_records,
    move_notes,
    move_relationships,
    record_merge_history,
)
from uok_contacts_core._internal.exchange_quality.duplicate_merge_rollback import (
    rollback_governed_records,
    rollback_groups,
    rollback_notes,
    rollback_relationships,
)
from uok_contacts_core._internal.exchange_quality.duplicate_merge_history import (
    assert_merge_state_unchanged,
    datetime_or_none,
    mark_snapshot_rolled_back,
    merge_snapshot,
    restore_primary_merge_attrs,
    store_merge_snapshot,
)
from uok_contacts_core._internal.delivery.facade import bounded_text, serialize_party, touch_party
from uok_contacts_core._internal.persistence.models import utcnow
from uok_contacts_core._internal.persistence.system_models import ContactDuplicateCandidate
from uok.security import Actor
from uok.util import dumps, loads


def cmd_merge_duplicate_contact(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    primary, duplicate, choices, merge_id, moved = _prepare_duplicate_merge(db, actor, payload, command_id)
    primary_attrs, snapshot = _merged_primary_attrs(primary, duplicate, choices, merge_id, moved)
    _apply_duplicate_merge_state(primary, duplicate, primary_attrs)
    _set_candidate_state(db, actor, primary.id, duplicate.id, "merged")
    db.flush()
    store_merge_snapshot(db, actor, primary, duplicate, snapshot)

    _emit_duplicate_merge_event(db, actor, primary, duplicate, choices, moved)
    return _duplicate_merge_result(db, actor, primary, duplicate, merge_id, moved)


def _prepare_duplicate_merge(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> tuple[Any, Any, dict[str, str], str, dict[str, list[Any]]]:
    primary = _party(db, actor, bounded_text(payload.get("primary_party_id"), "party_id"), "primary_party_id")
    duplicate = _party(db, actor, bounded_text(payload.get("duplicate_party_id"), "party_id"), "duplicate_party_id")
    if primary.id == duplicate.id:
        raise ValueError("primary_party_id and duplicate_party_id must be different")
    if primary.status == "purged" or duplicate.status == "purged":
        raise ValueError("purged contacts cannot be merged")
    primary_merged_into = str(loads(primary.attrs_json, {}).get("merged_into_party_id") or "")
    duplicate_merged_into = str(loads(duplicate.attrs_json, {}).get("merged_into_party_id") or "")
    if primary_merged_into:
        raise ValueError("primary_party_id is already merged into another contact")
    if duplicate_merged_into:
        raise ValueError("duplicate_party_id is already merged into another contact")

    choices = field_choices(payload.get("field_choices"))
    merge_id = bounded_text(payload.get("merge_id") or command_id, "client_reference")
    moved = {
        "notes": move_notes(db, actor, primary, duplicate),
        "groups": move_group_memberships(db, actor, primary, duplicate),
        "relationships": move_relationships(db, actor, primary, duplicate),
        "governed_records": move_governed_records(db, actor, primary, duplicate),
    }
    return primary, duplicate, choices, merge_id, moved


def _merged_primary_attrs(
    primary: Any,
    duplicate: Any,
    choices: dict[str, str],
    merge_id: str,
    moved: dict[str, list[Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    primary_attrs_before = loads(primary.attrs_json, {})
    duplicate_attrs_before = loads(duplicate.attrs_json, {})
    primary_attrs = merged_attrs(primary, duplicate, choices)
    snapshot = record_merge_history(
        primary_attrs,
        merge_id=merge_id,
        primary=primary,
        duplicate=duplicate,
        primary_attrs_before=primary_attrs_before,
        duplicate_attrs_before=duplicate_attrs_before,
        choices=choices,
        notes=moved["notes"],
        groups=moved["groups"],
        relationships=moved["relationships"],
        governed_records=moved["governed_records"],
    )
    return primary_attrs, snapshot


def _apply_duplicate_merge_state(primary: Any, duplicate: Any, primary_attrs: dict[str, Any]) -> None:
    duplicate_attrs = loads(duplicate.attrs_json, {})
    duplicate_attrs.update({
        "merged_into_party_id": primary.id,
        "merged_into_display_name": primary.display_name,
    })
    primary.attrs_json = dumps(primary_attrs)
    duplicate.attrs_json = dumps(duplicate_attrs)
    duplicate.status = "archived"
    duplicate.review_state = "ready"
    duplicate.archived_at = duplicate.archived_at or utcnow()
    primary.review_state = "ready" if not primary_attrs.get("duplicate_candidates") else primary.review_state
    touch_party(primary)
    touch_party(duplicate)


def _emit_duplicate_merge_event(db: Session, actor: Actor, primary: Any, duplicate: Any, choices: dict[str, str], moved: dict[str, list[Any]]) -> None:
    _emit_event(db, actor, "ContactDuplicateMerged", "Party", primary.id, {
        "primary_party_id": primary.id,
        "primary_display_name": primary.display_name,
        "duplicate_party_id": duplicate.id,
        "duplicate_display_name": duplicate.display_name,
        "field_choices": choices,
        "moved_notes": len(moved["notes"]),
        "moved_groups": len(moved["groups"]),
        "moved_relationships": len(moved["relationships"]),
    })


def _duplicate_merge_result(db: Session, actor: Actor, primary: Any, duplicate: Any, merge_id: str, moved: dict[str, list[Any]]) -> dict[str, Any]:
    result = serialize_party(db, primary, include_detail=True, actor=actor)
    result.update({
        "contact_id": primary.id,
        "merge_id": merge_id,
        "merged_duplicate_id": duplicate.id,
        "moved_notes": len(moved["notes"]),
        "moved_groups": len(moved["groups"]),
        "moved_relationships": len(moved["relationships"]),
    })
    return result


def cmd_rollback_duplicate_merge(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    primary = _party(db, actor, bounded_text(payload.get("primary_party_id"), "party_id"), "primary_party_id")
    duplicate = _party(db, actor, bounded_text(payload.get("duplicate_party_id"), "party_id"), "duplicate_party_id")
    merge_id = bounded_text(payload.get("merge_id"), "client_reference")
    primary_attrs = loads(primary.attrs_json, {})
    snapshot = merge_snapshot(db, actor, primary.id, duplicate.id, merge_id)
    if not snapshot:
        raise ValueError("merge history not found for the selected contacts")
    assert_merge_state_unchanged(db, actor, primary, duplicate, snapshot)

    rollback_notes(db, actor, primary, duplicate, snapshot.get("notes", []))
    rollback_groups(db, actor, primary, duplicate, snapshot.get("groups", []))
    rollback_relationships(db, actor, snapshot.get("relationships", []))
    rollback_governed_records(db, actor, primary, duplicate, snapshot.get("governed_records", {}))
    restore_primary_merge_attrs(primary_attrs, snapshot)
    mark_snapshot_rolled_back(primary_attrs, snapshot)

    duplicate.attrs_json = dumps(snapshot.get("duplicate_attrs_before") or {})
    duplicate.status = snapshot.get("duplicate_status_before") or "active"
    duplicate.review_state = snapshot.get("duplicate_review_state_before") or "needs_review"
    duplicate.archived_at = datetime_or_none(snapshot.get("duplicate_archived_at_before"))
    primary.review_state = snapshot.get("primary_review_state_before") or primary.review_state
    primary.attrs_json = dumps(primary_attrs)
    _set_candidate_state(db, actor, primary.id, duplicate.id, "open")
    touch_party(primary)
    touch_party(duplicate)
    db.flush()

    _emit_event(db, actor, "ContactDuplicateMergeRolledBack", "Party", primary.id, {
        "primary_party_id": primary.id,
        "duplicate_party_id": duplicate.id,
        "merge_id": snapshot.get("merge_id"),
    })
    result = serialize_party(db, primary, include_detail=True, actor=actor)
    result.update({
        "contact_id": primary.id,
        "rollback_duplicate_id": duplicate.id,
        "merge_id": snapshot.get("merge_id"),
    })
    return result


def _set_candidate_state(db: Session, actor: Actor, left_id: str, right_id: str, status: str) -> None:
    candidate = db.scalar(select(ContactDuplicateCandidate).where(
        ContactDuplicateCandidate.organization_id == actor.organization_id,
        or_(
            (ContactDuplicateCandidate.left_party_id == left_id) & (ContactDuplicateCandidate.right_party_id == right_id),
            (ContactDuplicateCandidate.left_party_id == right_id) & (ContactDuplicateCandidate.right_party_id == left_id),
        ),
    ))
    if not candidate:
        return
    candidate.status = status
    candidate.resolved_by_user_id = actor.user_id if status != "open" else None
    candidate.resolved_at = utcnow() if status != "open" else None
    candidate.updated_at = utcnow()
