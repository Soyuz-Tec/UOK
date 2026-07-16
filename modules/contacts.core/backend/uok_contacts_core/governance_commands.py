from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.kernel_models import Membership, User
from uok.security import Actor, has_permission
from uok.util import dumps, loads, row_dict

from .command_support import _emit_event, _party
from .models import utcnow
from .system_command_support import (
    bounded_mapping,
    bounded_text,
    contact_team,
    optional_datetime,
    record_activity,
    serialize_team,
)
from .system_models import ContactConsentRecord, ContactSavedView, ContactTeam, ContactTeamMember

CONSENT_STATUSES = {"granted", "denied", "pending", "revoked"}
CONSENT_CHANNELS = {"any", "email", "in_person", "phone", "post", "sms"}
SAVED_VIEW_KEYS = {
    "filters", "groupBy", "group_id", "party_type", "quality", "query", "review_state",
    "sortBy", "sortDir", "sort_by", "sort_dir", "source", "status", "view",
}


def cmd_record_contact_consent(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id"), 80), "party_id")
    if party.status == "purged":
        raise ValueError("purged contacts cannot receive consent records")
    status = bounded_text(payload.get("status"), 40).lower()
    channel = bounded_text(payload.get("channel"), 40).lower()
    purpose = bounded_text(payload.get("purpose"), 80).lower()
    if status not in CONSENT_STATUSES:
        raise ValueError(f"consent status must be one of: {', '.join(sorted(CONSENT_STATUSES))}")
    if channel not in CONSENT_CHANNELS:
        raise ValueError(f"consent channel must be one of: {', '.join(sorted(CONSENT_CHANNELS))}")
    if not purpose:
        raise ValueError("consent purpose is required")
    effective_at = optional_datetime(payload.get("effective_at")) or utcnow()
    expires_at = optional_datetime(payload.get("expires_at"))
    if expires_at and expires_at <= effective_at:
        raise ValueError("consent expiry must be after its effective time")
    row = ContactConsentRecord(
        organization_id=actor.organization_id,
        party_id=party.id,
        purpose=purpose,
        channel=channel,
        status=status,
        legal_basis=bounded_text(payload.get("legal_basis") or "unspecified", 80),
        allowed_use=bounded_text(payload.get("allowed_use"), 120),
        source=bounded_text(payload.get("source") or "manual", 80),
        evidence_json=dumps(bounded_mapping(payload.get("evidence"))),
        effective_at=effective_at,
        expires_at=expires_at,
        recorded_by_user_id=actor.user_id,
        created_at=utcnow(),
    )
    db.add(row)
    attrs = loads(party.attrs_json, {})
    attrs.update({"consent_status": status, "allowed_use": row.allowed_use})
    party.attrs_json = dumps(attrs)
    party.updated_at = utcnow()
    db.flush()
    record_activity(db, actor, party.id, "consent_recorded", "ContactConsentRecord", row.id, f"{channel} consent {status}", {"purpose": purpose, "channel": channel, "status": status})
    _emit_event(db, actor, "ContactConsentRecorded", "ContactConsentRecord", row.id, {"party_id": party.id, "purpose": purpose, "channel": channel, "status": status})
    return row_dict(row)


def cmd_create_contact_team(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    name = bounded_text(payload.get("name"), 120)
    if not name:
        raise ValueError("team name is required")
    if db.scalar(select(ContactTeam).where(ContactTeam.organization_id == actor.organization_id, ContactTeam.name == name)):
        raise ValueError("contact team name already exists")
    now = utcnow()
    team = ContactTeam(
        organization_id=actor.organization_id,
        name=name,
        description=bounded_text(payload.get("description"), 2_000),
        owner_user_id=actor.user_id,
        status="active",
        created_at=now,
        updated_at=now,
    )
    db.add(team)
    db.flush()
    db.add(ContactTeamMember(
        organization_id=actor.organization_id, team_id=team.id, user_id=actor.user_id,
        role="owner", status="active", added_by_user_id=actor.user_id,
        created_at=now, updated_at=now,
    ))
    _emit_event(db, actor, "ContactTeamCreated", "ContactTeam", team.id, {"name": name})
    return serialize_team(db, team, actor)


def cmd_update_contact_team(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    team = contact_team(db, actor, bounded_text(payload.get("team_id"), 80))
    if team.status == "archived":
        raise ValueError("archived contact teams cannot be edited; restore the team first")
    if "name" in payload:
        name = bounded_text(payload.get("name"), 120)
        if not name:
            raise ValueError("team name is required")
        duplicate = db.scalar(select(ContactTeam).where(
            ContactTeam.organization_id == actor.organization_id,
            ContactTeam.name == name,
            ContactTeam.id != team.id,
        ))
        if duplicate:
            raise ValueError("contact team name already exists")
        team.name = name
    if "description" in payload:
        team.description = bounded_text(payload.get("description"), 2_000)
    team.updated_at = utcnow()
    _emit_event(db, actor, "ContactTeamUpdated", "ContactTeam", team.id, {"name": team.name, "status": team.status})
    return serialize_team(db, team, actor)


def cmd_add_contact_team_member(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    team = contact_team(db, actor, bounded_text(payload.get("team_id"), 80))
    if team.status != "active":
        raise ValueError("archived contact teams cannot receive members")
    user_id = bounded_text(payload.get("user_id"), 80)
    role = bounded_text(payload.get("role") or "member", 40).lower()
    if role not in {"manager", "member", "owner", "viewer"}:
        raise ValueError("unsupported contact team role")
    membership = db.scalar(select(Membership).where(
        Membership.organization_id == actor.organization_id,
        Membership.user_id == user_id,
    ))
    if not db.get(User, user_id) or not membership:
        raise ValueError("team member must belong to the current organization")
    now = utcnow()
    member = db.scalar(select(ContactTeamMember).where(
        ContactTeamMember.organization_id == actor.organization_id,
        ContactTeamMember.team_id == team.id,
        ContactTeamMember.user_id == user_id,
    ))
    if not member:
        member = ContactTeamMember(
            organization_id=actor.organization_id, team_id=team.id, user_id=user_id,
            added_by_user_id=actor.user_id, created_at=now, updated_at=now,
        )
        db.add(member)
    member.role, member.status, member.updated_at = role, "active", now
    team.updated_at = now
    db.flush()
    _emit_event(db, actor, "ContactTeamMemberAdded", "ContactTeam", team.id, {"user_id": user_id, "role": role})
    return row_dict(member)


def cmd_remove_contact_team_member(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    team = contact_team(db, actor, bounded_text(payload.get("team_id"), 80))
    if team.status != "active":
        raise ValueError("archived contact teams cannot change members")
    user_id = bounded_text(payload.get("user_id"), 80)
    member = db.scalar(select(ContactTeamMember).where(
        ContactTeamMember.organization_id == actor.organization_id,
        ContactTeamMember.team_id == team.id,
        ContactTeamMember.user_id == user_id,
        ContactTeamMember.status == "active",
    ))
    if not member:
        raise ValueError("contact team member not found")
    another_owner = db.scalar(select(ContactTeamMember).where(
        ContactTeamMember.organization_id == actor.organization_id,
        ContactTeamMember.team_id == team.id,
        ContactTeamMember.status == "active",
        ContactTeamMember.role == "owner",
        ContactTeamMember.id != member.id,
    ))
    if member.role == "owner" and not another_owner:
        raise ValueError("assign another team owner before removing the last owner")
    now = utcnow()
    member.status, member.updated_at = "inactive", now
    team.updated_at = now
    _emit_event(db, actor, "ContactTeamMemberRemoved", "ContactTeam", team.id, {"user_id": user_id})
    return {"team_id": team.id, "user_id": user_id, "removed": True}


def cmd_save_contact_view(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    name = bounded_text(payload.get("name"), 120)
    if not name:
        raise ValueError("saved view name is required")
    query = bounded_mapping(payload.get("query"))
    unknown = set(query) - SAVED_VIEW_KEYS
    if unknown:
        raise ValueError(f"unsupported saved-view fields: {', '.join(sorted(unknown))}")
    filters = query.get("filters", {})
    if not isinstance(filters, dict):
        raise ValueError("saved-view filters must be an object")
    unknown_filters = set(filters) - {"contact-group", "quality", "review", "source", "status", "type"}
    if unknown_filters:
        raise ValueError(f"unsupported saved-view filters: {', '.join(sorted(unknown_filters))}")
    view = _saved_view(db, actor, payload, name)
    visibility_scope = bounded_text(payload.get("visibility_scope") or "personal", 40)
    if visibility_scope not in {"organization", "personal"}:
        raise ValueError("saved view visibility must be personal or organization")
    if visibility_scope == "organization" and not has_permission(actor, "contacts.manage"):
        raise PermissionError("contacts.manage")
    view.name, view.visibility_scope = name, visibility_scope
    view.is_pinned, view.query_json, view.updated_at = bool(payload.get("is_pinned")), dumps(query), utcnow()
    db.flush()
    _emit_event(db, actor, "ContactSavedViewSaved", "ContactSavedView", view.id, {"name": name})
    return row_dict(view)


def cmd_delete_contact_view(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    view = db.get(ContactSavedView, bounded_text(payload.get("view_id"), 80))
    if not view or view.organization_id != actor.organization_id or view.owner_user_id != actor.user_id:
        raise ValueError("saved contact view not found")
    view_id = view.id
    db.delete(view)
    _emit_event(db, actor, "ContactSavedViewDeleted", "ContactSavedView", view_id, {})
    return {"view_id": view_id, "deleted": True}


def _saved_view(db: Session, actor: Actor, payload: dict[str, Any], name: str) -> ContactSavedView:
    view_id = bounded_text(payload.get("view_id"), 80)
    view = db.get(ContactSavedView, view_id) if view_id else None
    if view and (view.organization_id != actor.organization_id or view.owner_user_id != actor.user_id):
        raise ValueError("saved contact view not found")
    view = view or db.scalar(select(ContactSavedView).where(
        ContactSavedView.organization_id == actor.organization_id,
        ContactSavedView.owner_user_id == actor.user_id,
        ContactSavedView.name == name,
    ))
    if view:
        return view
    view = ContactSavedView(
        organization_id=actor.organization_id,
        owner_user_id=actor.user_id,
        name=name,
        created_at=utcnow(),
        updated_at=utcnow(),
    )
    db.add(view)
    return view
