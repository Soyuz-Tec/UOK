from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.util import dumps, loads, row_dict

from uok_contacts_core._internal.persistence.models import Party, utcnow
from uok_contacts_core._internal.persistence.system_models import (
    ContactActivity,
    ContactCustomFieldDefinition,
    ContactDuplicateCandidate,
    ContactTeam,
    ContactTeamMember,
    PartyFact,
)


def serialize_fact(fact: PartyFact) -> dict[str, Any]:
    return row_dict(fact, {"value": fact.value_text})


def serialize_team(db: Session, team: ContactTeam) -> dict[str, Any]:
    members = db.scalars(select(ContactTeamMember).where(
        ContactTeamMember.organization_id == team.organization_id,
        ContactTeamMember.team_id == team.id,
        ContactTeamMember.status == "active",
    ).order_by(ContactTeamMember.role.asc(), ContactTeamMember.created_at.asc())).all()
    return row_dict(team, {
        "members": [row_dict(member) for member in members],
        "member_count": len(members),
    })


def serialize_duplicate_candidate(db: Session, row: ContactDuplicateCandidate) -> dict[str, Any]:
    left = db.get(Party, row.left_party_id)
    right = db.get(Party, row.right_party_id)
    return row_dict(row, {
        "reasons": loads(row.reasons_json, []),
        "left_name": left.display_name if left else "",
        "right_name": right.display_name if right else "",
    })


def contact_team(db: Session, actor: Actor, team_id: str) -> ContactTeam:
    team = db.get(ContactTeam, team_id)
    if not team or team.organization_id != actor.organization_id:
        raise ValueError("contact team not found")
    return team


def record_activity(
    db: Session,
    actor: Actor,
    party_id: str,
    activity_type: str,
    object_type: str,
    object_id: str,
    summary: str,
    payload: dict[str, Any],
) -> None:
    db.add(ContactActivity(
        organization_id=actor.organization_id,
        party_id=party_id,
        actor_user_id=actor.user_id,
        activity_type=activity_type,
        object_type=object_type,
        object_id=object_id,
        summary=summary[:240],
        payload_json=dumps(payload),
        occurred_at=utcnow(),
    ))


def bounded_text(value: Any, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) > limit:
        raise ValueError(f"value must be {limit} characters or fewer")
    return text


def bounded_mapping(value: Any) -> dict[str, Any]:
    if value in (None, ""):
        return {}
    if not isinstance(value, dict):
        raise ValueError("structured details must be an object")
    encoded = dumps(value)
    if len(encoded.encode("utf-8")) > 16_000:
        raise ValueError("structured details must be 16000 bytes or fewer")
    return value


def optional_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return result.replace(tzinfo=timezone.utc) if result.tzinfo is None else result


def validated_custom_field_value(definition: ContactCustomFieldDefinition, value: Any) -> Any:
    if value in (None, ""):
        if definition.required:
            raise ValueError("custom field value is required")
        return None
    if definition.field_type == "boolean":
        if not isinstance(value, bool):
            raise ValueError("boolean custom field requires true or false")
        return value
    if definition.field_type == "number":
        if isinstance(value, bool):
            raise ValueError("number custom field requires a number")
        try:
            return float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError("number custom field requires a number") from exc
    text = str(value).strip()
    if len(text) > 4_000:
        raise ValueError("custom field value must be 4000 characters or fewer")
    if definition.field_type == "date":
        try:
            datetime.fromisoformat(text)
        except ValueError as exc:
            raise ValueError("date custom field requires an ISO date") from exc
    if definition.field_type == "choice" and text not in set(loads(definition.options_json, [])):
        raise ValueError("custom field value is not an allowed choice")
    if definition.field_type == "url" and not text.lower().startswith(("http://", "https://")):
        raise ValueError("URL custom field requires http:// or https://")
    return text


def row_checksum(row: dict[str, Any]) -> str:
    return sha256(dumps(row).encode("utf-8")).hexdigest()
