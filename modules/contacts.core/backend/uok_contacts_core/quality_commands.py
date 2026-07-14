from __future__ import annotations

from collections import defaultdict
from datetime import timezone
from itertools import combinations
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import dumps, loads

from .command_support import _emit_event
from .fact_commands import cmd_upsert_contact_fact, normalized_fact_value
from .group_membership_commands import cmd_add_contacts_to_group
from .models import Party, utcnow
from .system_command_support import (
    bounded_text,
    contact_team,
    optional_datetime,
    record_activity,
    serialize_duplicate_candidate,
)
from .system_models import ContactDuplicateCandidate, PartyFact


def cmd_refresh_duplicate_candidates(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    parties = list(db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
    )).all())
    facts = list(db.scalars(select(PartyFact).join(
        Party,
        Party.id == PartyFact.party_id,
    ).where(
        PartyFact.organization_id == actor.organization_id,
        Party.organization_id == actor.organization_id,
        Party.status == "active",
        PartyFact.fact_type.in_(("email", "phone")),
        PartyFact.normalized_value != "",
    )).all())
    keys: dict[tuple[str, str], set[str]] = defaultdict(set)
    for fact in facts:
        keys[(fact.fact_type, fact.normalized_value)].add(fact.party_id)
    for party in parties:
        attrs = loads(party.attrs_json, {})
        for fact_type in ("email", "phone"):
            value = normalized_fact_value(fact_type, str(attrs.get(fact_type) or ""))
            if value:
                keys[(fact_type, value)].add(party.id)
    found: dict[tuple[str, str], set[str]] = defaultdict(set)
    for (fact_type, _), party_ids in keys.items():
        for left, right in combinations(sorted(party_ids), 2):
            found[(left, right)].add(fact_type)
    active_pairs = _upsert_duplicate_candidates(db, actor, found)
    _retire_stale_candidates(db, actor, active_pairs)
    _emit_event(db, actor, "ContactDuplicateCandidatesRefreshed", "ContactDuplicateCandidate", actor.organization_id, {"open_count": len(active_pairs)})
    return {"candidate_count": len(active_pairs), "algorithm": "normalized_blocking_v1"}


def _upsert_duplicate_candidates(
    db: Session,
    actor: Actor,
    found: dict[tuple[str, str], set[str]],
) -> set[tuple[str, str]]:
    now = utcnow()
    active_pairs: set[tuple[str, str]] = set()
    for (left, right), reasons in found.items():
        score = min(100, sum(60 if reason == "email" else 55 for reason in reasons))
        if score < 55:
            continue
        active_pairs.add((left, right))
        candidate = db.scalar(select(ContactDuplicateCandidate).where(
            ContactDuplicateCandidate.organization_id == actor.organization_id,
            ContactDuplicateCandidate.left_party_id == left,
            ContactDuplicateCandidate.right_party_id == right,
        ))
        if not candidate:
            candidate = ContactDuplicateCandidate(
                organization_id=actor.organization_id,
                left_party_id=left,
                right_party_id=right,
                score=score,
                created_at=now,
                updated_at=now,
            )
            db.add(candidate)
        candidate.score = score
        candidate.reasons_json = dumps(sorted(reasons))
        if candidate.status == "stale":
            candidate.status = "open"
        candidate.updated_at = now
    return active_pairs


def _retire_stale_candidates(db: Session, actor: Actor, active_pairs: set[tuple[str, str]]) -> None:
    existing = db.scalars(select(ContactDuplicateCandidate).where(
        ContactDuplicateCandidate.organization_id == actor.organization_id,
        ContactDuplicateCandidate.status == "open",
    )).all()
    for candidate in existing:
        if (candidate.left_party_id, candidate.right_party_id) not in active_pairs:
            candidate.status = "stale"
            candidate.updated_at = utcnow()


def cmd_resolve_duplicate_candidate(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    candidate = db.get(ContactDuplicateCandidate, bounded_text(payload.get("candidate_id"), 80))
    if not candidate or candidate.organization_id != actor.organization_id:
        raise ValueError("duplicate candidate not found")
    expected_updated_at = optional_datetime(payload.get("expected_updated_at"))
    actual_updated_at = candidate.updated_at
    if actual_updated_at.tzinfo is None:
        actual_updated_at = actual_updated_at.replace(tzinfo=timezone.utc)
    if expected_updated_at and actual_updated_at != expected_updated_at:
        raise ValueError("duplicate candidate changed; refresh before resolving it")
    status = bounded_text(payload.get("status"), 40)
    if status not in {"ignored", "not_duplicate"}:
        raise ValueError("invalid duplicate resolution")
    candidate.status = status
    candidate.resolved_by_user_id = actor.user_id
    candidate.resolved_at = utcnow()
    candidate.updated_at = candidate.resolved_at
    _emit_event(db, actor, "ContactDuplicateCandidateResolved", "ContactDuplicateCandidate", candidate.id, {"status": status})
    return serialize_duplicate_candidate(db, candidate)


def cmd_bulk_contacts(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party_ids = list(dict.fromkeys(
        bounded_text(value, 80)
        for value in payload.get("party_ids") or []
        if bounded_text(value, 80)
    ))
    if not party_ids or len(party_ids) > 200:
        raise ValueError("bulk operations require between 1 and 200 contact ids")
    parties = list(db.scalars(select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.id.in_(party_ids),
    )).all())
    if len(parties) != len(party_ids):
        raise ValueError("one or more contacts were not found")
    action = bounded_text(payload.get("action"), 40)
    value = bounded_text(payload.get("value"), 240)
    if action == "add_to_group":
        result = cmd_add_contacts_to_group(db, actor, {"group_id": value, "party_ids": party_ids}, command_id)
        result.update({"action": action, "affected_count": len(party_ids)})
        return result
    if action == "assign_team":
        team = contact_team(db, actor, value) if value else None
        if team and team.status != "active":
            raise ValueError("contacts cannot be assigned to an archived team")
    now = utcnow()
    for party in parties:
        _apply_bulk_action(db, actor, party, action, value, command_id, now)
    _emit_event(db, actor, "ContactsBulkUpdated", "Party", actor.organization_id, {"action": action, "affected_count": len(parties)})
    return {"action": action, "affected_count": len(parties), "party_ids": party_ids}


def _apply_bulk_action(db: Session, actor: Actor, party: Party, action: str, value: str, command_id: str, now) -> None:
    if action == "archive":
        if party.status != "purged":
            party.status, party.archived_at = "archived", now
    elif action == "restore":
        if party.status == "purged":
            raise ValueError("purged contacts cannot be restored")
        party.status, party.archived_at = "active", None
    elif action == "assign_team":
        party.team_id = value or None
        party.visibility_scope = "team" if value else "organization"
    elif action == "add_tag":
        cmd_upsert_contact_fact(db, actor, {
            "party_id": party.id, "fact_type": "tag", "label": "tag",
            "value": value, "is_primary": False,
        }, command_id)
    else:
        raise ValueError("unsupported bulk contact action")
    party.updated_at = now
    record_activity(db, actor, party.id, "bulk_contact_action", "Party", party.id, f"Bulk action: {action}", {"action": action})
