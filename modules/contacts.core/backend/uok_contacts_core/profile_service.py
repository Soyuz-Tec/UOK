from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import Party, PartyNote, PartyRelationship
from .profile_schemas import (
    MAX_PROFILE_EVIDENCE_ITEMS,
    MAX_PROFILE_LIST_ITEMS,
    MAX_PROFILE_TAG_LENGTH,
    PROFILE_ATTR_KEY,
    PROFILE_EVIDENCE_ATTR_KEY,
    ContactBusinessProfile,
    ContactProfileEvidenceRequest,
    ContactProfileRebuildRequest,
    ContactProfileWriteRequest,
    OrganizationIntelligence,
    PersonIntelligence,
    ProfileSource,
    RelationshipIntelligence,
)
from uok.util import dumps, loads

CONFIDENCE_SCORE = {
    "unknown": 0,
    "low": 30,
    "medium": 60,
    "high": 80,
    "verified": 100,
}


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def party_profile_type(party: Party) -> str:
    if party.party_type in {"person", "organization"}:
        return party.party_type
    return "unknown"


def load_party_attrs(party: Party) -> dict[str, Any]:
    attrs = loads(party.attrs_json, {})
    return attrs if isinstance(attrs, dict) else {}


def clean_list(values: list[Any] | None, *, item_limit: int = MAX_PROFILE_LIST_ITEMS, text_limit: int = MAX_PROFILE_TAG_LENGTH) -> list[str]:
    if not values:
        return []
    cleaned: list[str] = []
    seen: set[str] = set()
    for value in values:
        text = str(value or "").strip()[:text_limit]
        key = text.casefold()
        if not text or key in seen:
            continue
        seen.add(key)
        cleaned.append(text)
        if len(cleaned) >= item_limit:
            break
    return cleaned


def empty_business_profile(party: Party) -> ContactBusinessProfile:
    attrs = load_party_attrs(party)
    profile = ContactBusinessProfile(profile_type=party_profile_type(party), updated_at=utc_iso())
    profile.relationship.owner_user_id = party.owner_user_id
    if party.party_type == "person":
        profile.person.current_title = attrs.get("title") or None
        profile.person.current_company = attrs.get("organization_name") or attrs.get("company_name") or None
    elif party.party_type == "organization":
        profile.organization.legal_name = attrs.get("organization_name") or party.display_name
        website = attrs.get("website")
        if website:
            profile.organization.domains = clean_list([_domain_from_website(website)])
    return profile


def business_profile_from_party(party: Party) -> ContactBusinessProfile:
    attrs = load_party_attrs(party)
    raw_profile = attrs.get(PROFILE_ATTR_KEY)
    if isinstance(raw_profile, dict):
        try:
            profile = ContactBusinessProfile.model_validate(raw_profile)
        except ValueError:
            profile = empty_business_profile(party)
    else:
        profile = empty_business_profile(party)
    profile.profile_type = party_profile_type(party)
    return profile


def save_business_profile(party: Party, profile: ContactBusinessProfile) -> None:
    attrs = load_party_attrs(party)
    profile.updated_at = utc_iso()
    profile.tags = clean_list(profile.tags)
    profile.risk_flags = clean_list(profile.risk_flags)
    profile.sources = profile.sources[-MAX_PROFILE_EVIDENCE_ITEMS:]
    profile.scores = score_profile(party, profile)
    attrs[PROFILE_ATTR_KEY] = profile.model_dump(mode="json")
    party.attrs_json = dumps(attrs)


def business_profile_summary(party: Party) -> dict[str, Any]:
    profile = business_profile_from_party(party)
    return {
        "profile_type": profile.profile_type,
        "summary": profile.summary,
        "tags": profile.tags,
        "scores": profile.scores,
        "confidence": profile.confidence,
        "risk_flags": profile.risk_flags,
        "updated_at": profile.updated_at,
        "source_count": len(profile.sources),
    }


def business_profile_detail(party: Party) -> dict[str, Any]:
    profile = business_profile_from_party(party)
    return profile.model_dump(mode="json")


def evidence_rows(party: Party) -> list[dict[str, Any]]:
    rows = load_party_attrs(party).get(PROFILE_EVIDENCE_ATTR_KEY, [])
    return rows if isinstance(rows, list) else []


def apply_profile_write(party: Party, payload: dict[str, Any]) -> dict[str, Any]:
    request = ContactProfileWriteRequest.model_validate(payload)
    profile = business_profile_from_party(party)
    if request.summary is not None:
        profile.summary = request.summary.strip()
    if request.tags is not None:
        profile.tags = clean_list(request.tags)
    if request.person is not None:
        profile.person = request.person
    if request.organization is not None:
        profile.organization = request.organization
    if request.relationship is not None:
        profile.relationship = request.relationship
    if request.governance is not None:
        profile.governance = request.governance
    if request.confidence is not None:
        profile.confidence = request.confidence
    if request.risk_flags is not None:
        profile.risk_flags = clean_list(request.risk_flags)
    if request.source is not None:
        append_source(profile, request.source)
    if request.scores:
        profile.scores.update(_bounded_scores(request.scores))
    save_business_profile(party, profile)
    return business_profile_detail(party)


def record_profile_evidence(party: Party, payload: dict[str, Any]) -> dict[str, Any]:
    request = ContactProfileEvidenceRequest.model_validate(payload)
    profile = business_profile_from_party(party)
    append_source(profile, request.source)
    if request.merge_into_profile:
        merge_normalized_facts(profile, request.normalized_facts)
    attrs = load_party_attrs(party)
    existing = evidence_rows(party)
    evidence = {
        "source": request.source.model_dump(mode="json"),
        "normalized_facts": request.normalized_facts,
        "recorded_at": utc_iso(),
    }
    attrs[PROFILE_EVIDENCE_ATTR_KEY] = [*existing, evidence][-MAX_PROFILE_EVIDENCE_ITEMS:]
    party.attrs_json = dumps(attrs)
    save_business_profile(party, profile)
    return {"profile": business_profile_detail(party), "evidence_count": len(evidence_rows(party))}


def rebuild_business_profile(
    party: Party,
    payload: dict[str, Any],
    notes: list[PartyNote] | None = None,
    relationships: list[PartyRelationship] | None = None,
) -> dict[str, Any]:
    request = ContactProfileRebuildRequest.model_validate(payload)
    attrs = load_party_attrs(party)
    profile = business_profile_from_party(party)
    profile.profile_type = party_profile_type(party)
    profile.relationship.owner_user_id = party.owner_user_id
    if party.party_type == "person":
        profile.person.current_title = attrs.get("title") or profile.person.current_title
        profile.person.current_company = attrs.get("organization_name") or attrs.get("company_name") or profile.person.current_company
        profile.summary = profile.summary or _person_summary(party, attrs)
    elif party.party_type == "organization":
        profile.organization.legal_name = attrs.get("organization_name") or profile.organization.legal_name or party.display_name
        if attrs.get("website"):
            profile.organization.domains = clean_list([*profile.organization.domains, _domain_from_website(attrs["website"])])
        profile.summary = profile.summary or _organization_summary(party, attrs)
    else:
        profile.summary = profile.summary or f"{party.display_name} is a contact in UOK."
    if request.include_notes and notes:
        profile.tags = clean_list([*profile.tags, f"{len(notes)} internal notes"])
    if request.include_relationships and relationships:
        profile.tags = clean_list([*profile.tags, f"{len(relationships)} relationships"])
    append_source(profile, request.source or ProfileSource(provider="uok", source_type="contact_record", fields=["display_name", "attrs_json"]))
    save_business_profile(party, profile)
    return business_profile_detail(party)


def append_source(profile: ContactBusinessProfile, source: ProfileSource) -> None:
    source.fields = clean_list(source.fields, item_limit=MAX_PROFILE_LIST_ITEMS, text_limit=120)
    profile.sources = [*profile.sources, source][-MAX_PROFILE_EVIDENCE_ITEMS:]
    if CONFIDENCE_SCORE[source.confidence] > CONFIDENCE_SCORE[profile.confidence]:
        profile.confidence = source.confidence


def merge_normalized_facts(profile: ContactBusinessProfile, facts: dict[str, Any]) -> None:
    if not isinstance(facts, dict):
        return
    if isinstance(facts.get("summary"), str):
        profile.summary = facts["summary"].strip()[:1600]
    if isinstance(facts.get("tags"), list):
        profile.tags = clean_list([*profile.tags, *facts["tags"]])
    if isinstance(facts.get("risk_flags"), list):
        profile.risk_flags = clean_list([*profile.risk_flags, *facts["risk_flags"]])
    if isinstance(facts.get("confidence"), str) and facts["confidence"] in CONFIDENCE_SCORE:
        profile.confidence = facts["confidence"]
    if isinstance(facts.get("person"), dict):
        patch = PersonIntelligence.model_validate(facts["person"]).model_dump(exclude_none=True)
        profile.person = profile.person.model_copy(update=patch)
    if isinstance(facts.get("organization"), dict):
        patch = OrganizationIntelligence.model_validate(facts["organization"]).model_dump(exclude_none=True)
        profile.organization = profile.organization.model_copy(update=patch)
    if isinstance(facts.get("relationship"), dict):
        patch = RelationshipIntelligence.model_validate(facts["relationship"]).model_dump(exclude_none=True)
        profile.relationship = profile.relationship.model_copy(update=patch)
    if isinstance(facts.get("scores"), dict):
        profile.scores.update(_bounded_scores(facts["scores"]))


def score_profile(party: Party, profile: ContactBusinessProfile) -> dict[str, int]:
    attrs = load_party_attrs(party)
    base_fields = [party.display_name, attrs.get("email"), attrs.get("phone"), attrs.get("website"), profile.summary]
    if party.party_type == "person":
        intelligence_fields = [
            profile.person.current_title,
            profile.person.current_company,
            profile.person.seniority,
            profile.person.department,
            profile.person.decision_role,
            profile.person.professional_summary,
        ]
    else:
        intelligence_fields = [
            profile.organization.legal_name,
            profile.organization.domains,
            profile.organization.industries,
            profile.organization.size_range,
            profile.organization.revenue_range,
            profile.organization.headquarters,
        ]
    present = sum(1 for value in [*base_fields, *intelligence_fields] if _has_value(value))
    possible = len(base_fields) + len(intelligence_fields)
    completeness = round((present / max(possible, 1)) * 100)
    confidence = CONFIDENCE_SCORE.get(profile.confidence, 0)
    provenance = min(100, len(profile.sources) * 25)
    relationship = sum(25 for value in [
        profile.relationship.stakeholder_role,
        profile.relationship.relationship_stage,
        profile.relationship.relationship_strength,
        profile.relationship.next_step,
    ] if _has_value(value))
    result = dict(profile.scores)
    result.update({
        "completeness": completeness,
        "confidence": confidence,
        "provenance": provenance,
        "relationship": min(100, relationship),
        "profile_health": round((completeness * 0.45) + (confidence * 0.30) + (provenance * 0.15) + (min(100, relationship) * 0.10)),
    })
    return _bounded_scores(result)


def _bounded_scores(scores: dict[str, Any]) -> dict[str, int]:
    bounded: dict[str, int] = {}
    for key, value in scores.items():
        try:
            bounded[str(key)[:80]] = max(0, min(100, int(value)))
        except (TypeError, ValueError):
            continue
    return bounded


def _has_value(value: Any) -> bool:
    if isinstance(value, list | tuple | set):
        return bool(value)
    return value not in (None, "", {})


def _person_summary(party: Party, attrs: dict[str, Any]) -> str:
    title = attrs.get("title")
    company = attrs.get("organization_name") or attrs.get("company_name")
    if title and company:
        return f"{party.display_name} is listed as {title} at {company}."
    if title:
        return f"{party.display_name} is listed as {title}."
    if company:
        return f"{party.display_name} is associated with {company}."
    return f"{party.display_name} is a person contact in UOK."


def _organization_summary(party: Party, attrs: dict[str, Any]) -> str:
    website = attrs.get("website")
    if website:
        return f"{party.display_name} is an organization contact with website {website}."
    return f"{party.display_name} is an organization contact in UOK."


def _domain_from_website(website: str) -> str:
    text = str(website).strip().lower()
    text = text.removeprefix("https://").removeprefix("http://").removeprefix("www.")
    return text.split("/", 1)[0]
