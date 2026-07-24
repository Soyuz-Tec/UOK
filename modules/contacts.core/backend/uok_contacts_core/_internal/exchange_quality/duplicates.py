from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok_contacts_core._internal.registry.validation import choose_display_name, contact_attrs, normalize_match
from uok_contacts_core._internal.persistence.models import Party
from uok.kernel.security import Actor
from uok.util import loads


def find_duplicate_candidates(db: Session, actor: Actor, payload: dict[str, Any], exclude_party_id: str | None = None) -> list[dict[str, str]]:
    display_name = normalize_match(choose_display_name(payload))
    attrs = contact_attrs(payload)
    email = normalize_match(attrs.get("email"))
    phone = normalize_match(attrs.get("phone"))
    candidates: list[dict[str, str]] = []
    rows = db.scalars(select(Party).where(Party.organization_id == actor.organization_id, Party.status != "purged")).all()
    for row in rows:
        reasons = _duplicate_reasons(row, display_name, email, phone, exclude_party_id)
        if reasons:
            candidates.append({"id": row.id, "display_name": row.display_name, "reason": ", ".join(reasons)})
    return candidates[:5]


def _duplicate_reasons(row: Party, display_name: str, email: str, phone: str, exclude_party_id: str | None) -> list[str]:
    if exclude_party_id and row.id == exclude_party_id:
        return []
    row_attrs = loads(row.attrs_json, {})
    reasons: list[str] = []
    if email and normalize_match(row_attrs.get("email")) == email:
        reasons.append("email")
    if phone and normalize_match(row_attrs.get("phone")) == phone:
        reasons.append("phone")
    if display_name and normalize_match(row.display_name) == display_name:
        reasons.append("name")
    return reasons
