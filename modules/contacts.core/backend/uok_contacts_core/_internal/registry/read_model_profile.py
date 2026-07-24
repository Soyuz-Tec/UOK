from __future__ import annotations

from typing import Any, Iterable

from uok_contacts_core._internal.persistence.models import Party
from uok_contacts_core._internal.registry.validation import CONTACT_ATTR_FIELDS
from uok.util import loads


def business_intelligence_profile(
    party: Party,
    *,
    attrs: dict[str, Any] | None = None,
    notes: list[dict[str, Any]] | None = None,
    relationships: list[dict[str, Any]] | None = None,
    groups: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    attrs = attrs or _party_attrs(party)
    notes = notes or []
    relationships = relationships or []
    groups = groups or []
    duplicate_candidates = attrs.get("duplicate_candidates", [])
    duplicate_candidate_count = len(duplicate_candidates) if isinstance(duplicate_candidates, list) else 0
    fact_count = _meaningful_fact_count(party, attrs)
    note_count = len(notes)
    relationship_count = len(relationships)
    group_count = len(groups)
    business_domain_group_count = sum(1 for group in groups if str(group.get("kind", "")) == "business_domain")
    imported = party.source in {"csv_import", "gmail", "email"}
    readiness = _profile_readiness(party.status, party.review_state, fact_count, duplicate_candidate_count)
    return {
        "profile_type": party.party_type if party.party_type in {"person", "organization"} else "unknown",
        "headline": _profile_headline(readiness),
        "summary": _profile_summary(party, fact_count, note_count, relationship_count, group_count, duplicate_candidate_count, imported),
        "confidence": _profile_confidence(party.status, party.review_state, fact_count, note_count, relationship_count, group_count, duplicate_candidate_count),
        "readiness": readiness,
        "signal_count": 1 + note_count + relationship_count + group_count + duplicate_candidate_count + (1 if imported else 0),
        "fact_count": fact_count,
        "note_count": note_count,
        "relationship_count": relationship_count,
        "group_count": group_count,
        "business_domain_group_count": business_domain_group_count,
        "duplicate_candidate_count": duplicate_candidate_count,
        "primary_organization_name": _primary_organization_name(party, attrs, relationships),
        "recent_note": notes[0].get("body", "") if notes else "",
        "updated_at": data_value_or_none(party.updated_at),
        "tags": _profile_tags(party, imported, duplicate_candidate_count, relationship_count, group_count, business_domain_group_count),
        "risk_flags": _risk_flags(party, fact_count, duplicate_candidate_count),
        "group_names": _unique_text_values(row.get("name", "") for row in groups),
        "relationship_names": _unique_text_values(row.get("related_party_name", "") for row in relationships),
    }


def data_value_or_none(value: Any) -> str | None:
    return value.isoformat() if hasattr(value, "isoformat") else None


def _party_attrs(party: Party) -> dict[str, Any]:
    return loads(party.attrs_json, {})


def _meaningful_fact_count(party: Party, attrs: dict[str, Any]) -> int:
    seen: set[str] = set()
    count = 0
    for value in [party.display_name, *[attrs.get(field) for field in CONTACT_ATTR_FIELDS], attrs.get("company_name")]:
        text = str(value or "").strip()
        if not text:
            continue
        key = text.casefold()
        if key in seen:
            continue
        seen.add(key)
        count += 1
    return count


def _primary_organization_name(party: Party, attrs: dict[str, Any], relationships: list[dict[str, Any]]) -> str:
    if party.party_type == "organization":
        return str(attrs.get("organization_name") or party.display_name or "").strip()
    for relationship in relationships:
        if relationship.get("relationship_type") == "works_for" and relationship.get("related_party_name"):
            return str(relationship.get("related_party_name", "")).strip()
    return str(attrs.get("organization_name") or attrs.get("company_name") or "").strip()


def _profile_readiness(status: str, review_state: str, fact_count: int, duplicate_candidate_count: int) -> str:
    if status == "purged":
        return "purged"
    if status == "archived":
        return "archived"
    if review_state == "possible_duplicate" or duplicate_candidate_count:
        return "possible_duplicate"
    if review_state in {"needs_review", "incomplete"}:
        return review_state
    if fact_count < 2:
        return "incomplete"
    return "ready"


def _profile_confidence(
    status: str,
    review_state: str,
    fact_count: int,
    note_count: int,
    relationship_count: int,
    group_count: int,
    duplicate_candidate_count: int,
) -> str:
    if status in {"archived", "purged"} or review_state == "possible_duplicate" or duplicate_candidate_count:
        return "low"
    supporting_signals = note_count + relationship_count + group_count
    if review_state in {"needs_review", "incomplete"}:
        return "medium"
    if fact_count >= 4 and supporting_signals >= 1:
        return "high"
    if fact_count >= 2:
        return "medium"
    return "low"


def _profile_headline(readiness: str) -> str:
    return {
        "ready": "Ready contact",
        "needs_review": "Needs review",
        "possible_duplicate": "Possible duplicate",
        "incomplete": "Incomplete contact",
        "archived": "Archived contact",
        "purged": "Purged contact",
    }.get(readiness, "Contact profile")


def _profile_summary(
    party: Party,
    fact_count: int,
    note_count: int,
    relationship_count: int,
    group_count: int,
    duplicate_candidate_count: int,
    imported: bool,
) -> str:
    if party.status == "purged":
        return "This contact has been purged."
    if party.status == "archived":
        return "This contact is archived."
    if duplicate_candidate_count:
        return "This record has duplicate signals that should be reviewed."
    if imported and party.review_state != "ready":
        return "Imported contact awaiting review."
    if party.review_state == "needs_review":
        return "This contact is waiting for review before it is fully trusted."
    if party.review_state == "incomplete" or fact_count < 2:
        return "Add another meaningful fact before relying on this record."
    pieces = [f"{fact_count} contact facts"]
    if note_count:
        pieces.append(f"{note_count} notes")
    if relationship_count:
        pieces.append(f"{relationship_count} relationships")
    if group_count:
        pieces.append(f"{group_count} groups")
    return "Ready contact with " + ", ".join(pieces) + "."


def _profile_tags(
    party: Party,
    imported: bool,
    duplicate_candidate_count: int,
    relationship_count: int,
    group_count: int,
    business_domain_group_count: int,
) -> list[str]:
    return _unique_text_values([
        party.party_type,
        party.review_state,
        "imported" if imported else "",
        "duplicate_candidate" if duplicate_candidate_count else "",
        "relationship_linked" if relationship_count else "",
        "grouped" if group_count else "",
        "business_domain_grouped" if business_domain_group_count else "",
    ])


def _risk_flags(party: Party, fact_count: int, duplicate_candidate_count: int) -> list[str]:
    return _unique_text_values([
        "archived" if party.status == "archived" else "",
        "purged" if party.status == "purged" else "",
        "possible_duplicate" if party.review_state == "possible_duplicate" or duplicate_candidate_count else "",
        "needs_review" if party.review_state == "needs_review" else "",
        "incomplete" if party.review_state == "incomplete" or fact_count < 2 else "",
    ])


def _unique_text_values(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        text = str(value or "").strip()
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result
