from __future__ import annotations

from typing import Any

from sqlalchemy import String, cast, func, literal_column, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from uok_contacts_core._internal.registry.access import can_manage_contacts, readable_note_records, readable_party_filter, readable_relationship_records
from uok_contacts_core._internal.groups_relationships.group_read_model import readable_group_party_ids
from uok_contacts_core._internal.persistence.models import ContactGroupMember, Party, PartyNote, PartyRelationship
from uok_contacts_core._internal.registry.read_model_filters import apply_contact_extra_filters, party_matches_extra_filters, validated_quality_filter
from uok_contacts_core._internal.registry.read_model_rows import _party_attrs, serialize_party
from uok_contacts_core._internal.registry.validation import CONTACT_ATTR_FIELDS
from uok.kernel.security import Actor, has_permission

CONTACT_SORT_COLUMNS = {
    "display_name": Party.display_name,
    "updated_at": Party.updated_at,
    "created_at": Party.created_at,
    "status": Party.status,
    "review_state": Party.review_state,
    "party_type": Party.party_type,
    "source": Party.source,
}


def list_parties(
    db: Session,
    actor: Actor,
    query: str = "",
    group_id: str = "",
    status: str = "active",
    review_state: str = "",
    party_type: str = "",
    source: str = "all",
    quality: str = "all",
    limit: int = 200,
    offset: int = 0,
    sort_by: str = "updated_at",
    sort_dir: str = "desc",
) -> list[dict[str, Any]]:
    quality = validated_quality_filter(quality)
    if _is_postgres(db):
        return _list_parties_postgres(db, actor, query, group_id, status, review_state, party_type, source, quality, limit, offset, sort_by, sort_dir)
    return _list_parties_python(db, actor, query, group_id, status, review_state, party_type, source, quality, limit, offset, sort_by, sort_dir)


def count_parties(
    db: Session,
    actor: Actor,
    query: str = "",
    group_id: str = "",
    status: str = "active",
    review_state: str = "",
    party_type: str = "",
    source: str = "all",
    quality: str = "all",
) -> int:
    quality = validated_quality_filter(quality)
    if _is_postgres(db):
        stmt = _filtered_postgres_party_statement(db, actor, query, group_id, status, review_state, party_type, source, quality)
        return int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    return len(_filtered_python_parties(db, actor, query, group_id, status, review_state, party_type, source, quality))


def review_queue(db: Session, actor: Actor, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
    stmt = _readable_party_statement(
        select(Party).where(
            Party.organization_id == actor.organization_id,
            Party.status != "purged",
            Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")),
        ),
        db,
        actor,
    )
    rows = db.scalars(
        stmt.order_by(Party.updated_at.desc(), Party.created_at.desc(), Party.id.asc())
        .offset(_bounded_offset(offset))
        .limit(_bounded_limit(limit))
    ).all()
    return [serialize_party(db, row, actor=actor) for row in rows]


def review_queue_count(db: Session, actor: Actor) -> int:
    stmt = _readable_party_statement(
        select(Party.id).where(
            Party.organization_id == actor.organization_id,
            Party.status != "purged",
            Party.review_state.in_(("needs_review", "possible_duplicate", "incomplete")),
        ),
        db,
        actor,
    )
    return int(db.scalar(select(func.count()).select_from(stmt.subquery())) or 0)


def _list_parties_python(
    db: Session,
    actor: Actor,
    query: str,
    group_id: str,
    status: str,
    review_state: str,
    party_type: str,
    source: str,
    quality: str,
    limit: int,
    offset: int,
    sort_by: str,
    sort_dir: str,
) -> list[dict[str, Any]]:
    page_limit = _bounded_limit(limit)
    page_offset = _bounded_offset(offset)
    result = _filtered_python_parties(db, actor, query, group_id, status, review_state, party_type, source, quality, sort_by, sort_dir)
    return result[page_offset:page_offset + page_limit]


def _filtered_python_parties(
    db: Session,
    actor: Actor,
    query: str,
    group_id: str,
    status: str,
    review_state: str,
    party_type: str,
    source: str = "all",
    quality: str = "all",
    sort_by: str = "updated_at",
    sort_dir: str = "desc",
) -> list[dict[str, Any]]:
    rows = list(db.scalars(
        select(Party)
        .where(Party.organization_id == actor.organization_id)
        .order_by(*_contact_ordering(sort_by, sort_dir))
    ).all())
    allowed = readable_party_filter(actor, db)
    group_party_ids = readable_group_party_ids(db, actor, group_id) if group_id else None
    query_value = query.lower().strip()
    result: list[dict[str, Any]] = []
    for party in rows:
        if group_party_ids is not None and party.id not in group_party_ids:
            continue
        if not _party_matches_filters(party, allowed, status, review_state, party_type):
            continue
        if not party_matches_extra_filters(db, actor, party, source, quality):
            continue
        notes = readable_note_records(db, party.id, actor)
        relationships = readable_relationship_records(db, actor, party.id, allowed)
        if query_value and query_value not in _party_search_text(party, notes, relationships):
            continue
        result.append(serialize_party(db, party, actor=actor))
    return result


def _list_parties_postgres(
    db: Session,
    actor: Actor,
    query: str,
    group_id: str,
    status: str,
    review_state: str,
    party_type: str,
    source: str,
    quality: str,
    limit: int,
    offset: int,
    sort_by: str,
    sort_dir: str,
) -> list[dict[str, Any]]:
    stmt = _filtered_postgres_party_statement(db, actor, query, group_id, status, review_state, party_type, source, quality)
    if query.strip():
        search_query = func.websearch_to_tsquery("simple", query.strip())
        stmt = stmt.order_by(func.ts_rank_cd(_postgres_contact_search_vector(), search_query).desc(), *_contact_ordering(sort_by, sort_dir))
    else:
        stmt = stmt.order_by(*_contact_ordering(sort_by, sort_dir))
    rows = db.scalars(stmt.offset(_bounded_offset(offset)).limit(_bounded_limit(limit))).all()
    return [serialize_party(db, row, actor=actor) for row in rows]


def _filtered_postgres_party_statement(db: Session, actor: Actor, query: str, group_id: str, status: str, review_state: str, party_type: str, source: str, quality: str):
    stmt = _readable_party_statement(select(Party).where(Party.organization_id == actor.organization_id), db, actor)
    if group_id:
        group_party_ids = readable_group_party_ids(db, actor, group_id)
        if not group_party_ids:
            return stmt.where(Party.id == "__empty_group__")
        stmt = stmt.join(ContactGroupMember, ContactGroupMember.party_id == Party.id).where(
            ContactGroupMember.organization_id == actor.organization_id,
            ContactGroupMember.group_id == group_id,
            Party.id.in_(group_party_ids),
        )
    if status and status != "all":
        stmt = stmt.where(Party.status == status)
    if review_state and review_state != "all":
        stmt = stmt.where(Party.review_state == review_state)
    if party_type and party_type != "all":
        stmt = stmt.where(Party.party_type == party_type)
    stmt = apply_contact_extra_filters(stmt, actor, source, quality)
    if query.strip():
        stmt = stmt.where(_postgres_contact_search_vector().op("@@")(func.websearch_to_tsquery("simple", query.strip())))
    return stmt


def _postgres_contact_search_vector():
    attrs = cast(Party.attrs_json, JSONB)
    parts = [
        func.coalesce(Party.display_name, ""),
        func.coalesce(Party.party_type, ""),
        func.coalesce(Party.status, ""),
        func.coalesce(Party.review_state, ""),
        func.coalesce(Party.source, ""),
        *[
            func.coalesce(
                attrs.op("->>", return_type=String)(literal_column(f"'{field}'")),
                "",
            )
            for field in CONTACT_ATTR_FIELDS
        ],
    ]
    separator = literal_column("' '", type_=String)
    text = parts[0]
    for part in parts[1:]:
        text = text + separator + part
    return func.to_tsvector(literal_column("'simple'::regconfig"), text)


def _party_search_text(party: Party, notes: list[PartyNote] | None = None, relationships: list[PartyRelationship] | None = None) -> str:
    attrs = _party_attrs(party)
    parts = [party.display_name, party.party_type, party.status, party.review_state, party.source]
    parts.extend(str(attrs.get(field, "")) for field in CONTACT_ATTR_FIELDS)
    for note in notes or []:
        parts.append(note.body)
    for relationship in relationships or []:
        parts.append(relationship.relationship_type)
    return " ".join(parts).lower()


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bool(bind and bind.dialect.name == "postgresql")


def _readable_party_statement(stmt, db: Session, actor: Actor):
    if can_manage_contacts(actor):
        if has_permission(actor, "contacts.purge"):
            return stmt
        return stmt.where(Party.status != "purged")
    from .access import actor_contact_team_ids

    team_ids = actor_contact_team_ids(db, actor)
    visibility = (Party.owner_user_id == actor.user_id) | (Party.visibility_scope == "organization")
    if team_ids:
        visibility = visibility | ((Party.visibility_scope == "team") & Party.team_id.in_(team_ids))
    return stmt.where(
        Party.status != "purged",
        visibility,
    )


def _bounded_limit(limit: int) -> int:
    return max(1, min(limit, 500))


def _bounded_offset(offset: int) -> int:
    return max(0, offset)


def _contact_ordering(sort_by: str, sort_dir: str):
    column = CONTACT_SORT_COLUMNS.get(sort_by, Party.updated_at)
    primary = column.asc() if sort_dir == "asc" else column.desc()
    return primary, Party.id.asc()


def _party_matches_filters(party: Party, allowed, status: str, review_state: str, party_type: str) -> bool:
    if not allowed(party):
        return False
    if status and status != "all" and party.status != status:
        return False
    if review_state and review_state != "all" and party.review_state != review_state:
        return False
    return not (party_type and party_type != "all" and party.party_type != party_type)
