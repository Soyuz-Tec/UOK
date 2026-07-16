from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from uok.kernel.security import Actor
from uok.util import loads, row_dict

from uok_contacts_core._internal.registry.access import actor_contact_team_ids, can_manage_contacts, get_party_or_error, readable_party_filter
from uok_contacts_core._internal.persistence.models import ContactImportBatch, Party
from uok_contacts_core._internal.governance.system_commands import serialize_duplicate_candidate, serialize_fact, serialize_team
from uok_contacts_core._internal.persistence.system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactCustomFieldDefinition,
    ContactDuplicateCandidate,
    ContactExternalIdentity,
    ContactImportRow,
    ContactSavedView,
    ContactTeam,
    PartyCustomFieldValue,
    PartyFact,
)


def contact_fact_rows(db: Session, actor: Actor, party_id: str) -> list[dict[str, Any]]:
    get_party_or_error(db, actor, party_id)
    rows = db.scalars(select(PartyFact).where(
        PartyFact.organization_id == actor.organization_id,
        PartyFact.party_id == party_id,
    ).order_by(PartyFact.fact_type.asc(), PartyFact.is_primary.desc(), PartyFact.label.asc(), PartyFact.created_at.asc())).all()
    return [serialize_fact(row) for row in rows]


def contact_consent_rows(db: Session, actor: Actor, party_id: str) -> list[dict[str, Any]]:
    get_party_or_error(db, actor, party_id)
    rows = db.scalars(select(ContactConsentRecord).where(
        ContactConsentRecord.organization_id == actor.organization_id,
        ContactConsentRecord.party_id == party_id,
    ).order_by(ContactConsentRecord.effective_at.desc(), ContactConsentRecord.created_at.desc())).all()
    return [row_dict(row) for row in rows]


def contact_team_rows(db: Session, actor: Actor, include_archived: bool = False) -> list[dict[str, Any]]:
    stmt = select(ContactTeam).where(ContactTeam.organization_id == actor.organization_id)
    if not include_archived:
        stmt = stmt.where(ContactTeam.status == "active")
    if not can_manage_contacts(actor):
        team_ids = actor_contact_team_ids(db, actor)
        if not team_ids:
            return []
        stmt = stmt.where(ContactTeam.id.in_(team_ids))
    rows = db.scalars(stmt.order_by(ContactTeam.name.asc())).all()
    return [serialize_team(db, row) for row in rows]


def contact_saved_view_rows(db: Session, actor: Actor) -> list[dict[str, Any]]:
    rows = db.scalars(select(ContactSavedView).where(
        ContactSavedView.organization_id == actor.organization_id,
        or_(
            ContactSavedView.owner_user_id == actor.user_id,
            ContactSavedView.visibility_scope == "organization",
        ),
    ).order_by(ContactSavedView.is_pinned.desc(), ContactSavedView.name.asc())).all()
    return [row_dict(row, {"can_edit": row.owner_user_id == actor.user_id}) for row in rows]


def contact_activity_rows(
    db: Session,
    actor: Actor,
    party_id: str,
    *,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict[str, Any]], int]:
    get_party_or_error(db, actor, party_id)
    base = select(ContactActivity).where(
        ContactActivity.organization_id == actor.organization_id,
        ContactActivity.party_id == party_id,
    )
    total = int(db.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = db.scalars(base.order_by(ContactActivity.occurred_at.desc(), ContactActivity.id.desc()).offset(offset).limit(limit)).all()
    return [row_dict(row) for row in rows], total


def relationship_lookup_rows(db: Session, actor: Actor, query: str, exclude_party_id: str = "", limit: int = 20) -> list[dict[str, Any]]:
    query_value = query.strip().casefold()
    if len(query_value) < 2:
        return []
    stmt = select(Party).where(
        Party.organization_id == actor.organization_id,
        Party.status == "active",
        func.lower(Party.display_name).like(f"%{query_value}%"),
    ).order_by(Party.display_name.asc()).limit(max(1, min(limit * 3, 100)))
    allowed = readable_party_filter(actor, db)
    result: list[dict[str, Any]] = []
    for party in db.scalars(stmt).all():
        if party.id == exclude_party_id or not allowed(party):
            continue
        attrs = loads(party.attrs_json, {})
        result.append({
            "id": party.id,
            "display_name": party.display_name,
            "party_type": party.party_type,
            "email": attrs.get("email", ""),
            "phone": attrs.get("phone", ""),
        })
        if len(result) >= limit:
            break
    return result


def duplicate_candidate_rows(db: Session, actor: Actor, status: str = "open", limit: int = 100, offset: int = 0) -> tuple[list[dict[str, Any]], int]:
    base = select(ContactDuplicateCandidate).where(
        ContactDuplicateCandidate.organization_id == actor.organization_id,
        ContactDuplicateCandidate.status == status,
    )
    total = int(db.scalar(select(func.count()).select_from(base.subquery())) or 0)
    rows = db.scalars(base.order_by(ContactDuplicateCandidate.score.desc(), ContactDuplicateCandidate.updated_at.desc()).offset(offset).limit(limit)).all()
    return [serialize_duplicate_candidate(db, row) for row in rows], total


def contact_import_row_results(db: Session, actor: Actor, batch_id: str) -> list[dict[str, Any]]:
    batch = db.get(ContactImportBatch, batch_id)
    if not batch or batch.organization_id != actor.organization_id:
        raise ValueError("contact import batch not found")
    rows = db.scalars(select(ContactImportRow).where(
        ContactImportRow.organization_id == actor.organization_id,
        ContactImportRow.batch_id == batch_id,
    ).order_by(ContactImportRow.row_number.asc())).all()
    return [row_dict(row) for row in rows]


def contact_external_identity_rows(db: Session, actor: Actor, party_id: str) -> list[dict[str, Any]]:
    get_party_or_error(db, actor, party_id)
    rows = db.scalars(select(ContactExternalIdentity).where(
        ContactExternalIdentity.organization_id == actor.organization_id,
        ContactExternalIdentity.party_id == party_id,
    ).order_by(ContactExternalIdentity.provider.asc())).all()
    return [row_dict(row) for row in rows]


def contact_custom_field_rows(db: Session, actor: Actor, include_archived: bool = False) -> list[dict[str, Any]]:
    stmt = select(ContactCustomFieldDefinition).where(ContactCustomFieldDefinition.organization_id == actor.organization_id)
    if not include_archived:
        stmt = stmt.where(ContactCustomFieldDefinition.status == "active")
    rows = db.scalars(stmt.order_by(ContactCustomFieldDefinition.label.asc())).all()
    return [row_dict(row) for row in rows]


def party_custom_value_rows(db: Session, actor: Actor, party_id: str) -> list[dict[str, Any]]:
    get_party_or_error(db, actor, party_id)
    rows = db.execute(select(PartyCustomFieldValue, ContactCustomFieldDefinition).join(
        ContactCustomFieldDefinition,
        ContactCustomFieldDefinition.id == PartyCustomFieldValue.field_definition_id,
    ).where(
        PartyCustomFieldValue.organization_id == actor.organization_id,
        PartyCustomFieldValue.party_id == party_id,
    ).order_by(ContactCustomFieldDefinition.label.asc())).all()
    return [row_dict(value, {
        "field_key": definition.field_key,
        "label": definition.label,
        "field_type": definition.field_type,
        "value": loads(value.value_json, None),
    }) for value, definition in rows]


def contact_interoperability_status() -> dict[str, Any]:
    return {
        "formats": {
            "csv": {"import": True, "export": True},
            "vcard": {"import": True, "export": True},
        },
        "providers": [
            {"id": "google", "adapter": "not_installed", "configured": False},
            {"id": "microsoft", "adapter": "not_installed", "configured": False},
            {"id": "carddav", "adapter": "not_installed", "configured": False},
        ],
        "sync_claim": "No provider synchronization is active until a qualified adapter is installed and configured.",
    }
