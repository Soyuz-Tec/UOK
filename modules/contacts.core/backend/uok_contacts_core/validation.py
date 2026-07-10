from __future__ import annotations

from typing import Any

from .phone_numbers import normalize_phone

CONTACT_ATTR_FIELDS = (
    "given_name",
    "family_name",
    "organization_name",
    "email",
    "phone",
    "website",
    "address",
    "title",
    "birthday",
    "important_date",
    "instant_message",
    "tags",
    "consent_status",
    "allowed_use",
    "confidence_level",
)

MEANINGFUL_FIELDS = CONTACT_ATTR_FIELDS + ("display_name", "note")
MAX_CONTACT_DISPLAY_NAME_LENGTH = 180
MAX_CONTACT_NAME_LENGTH = 180
MAX_CONTACT_EMAIL_LENGTH = 254
MAX_CONTACT_PHONE_LENGTH = 64
MAX_CONTACT_WEBSITE_LENGTH = 512
MAX_CONTACT_ADDRESS_LENGTH = 1000
MAX_CONTACT_TITLE_LENGTH = 120
MAX_CONTACT_GROUP_NAME_LENGTH = 120
MAX_CONTACT_GROUP_DESCRIPTION_LENGTH = 500
MAX_CONTACT_NOTE_LENGTH = 4000
MAX_CONTACT_REFERENCE_LENGTH = 120
MAX_CONTACT_SOURCE_LENGTH = 80
MAX_CONTACT_STATUS_LENGTH = 40
MAX_CONTACT_ID_LENGTH = 80
MAX_CSV_IMPORT_BYTES = 1_000_000
MAX_CSV_IMPORT_ROWS = 1000
MAX_IMPORT_RESULT_ITEMS = 100
VALID_CONTACT_VISIBILITY_SCOPES = {"organization", "team", "private"}
VALID_CONTACT_GROUP_KINDS = {"business_domain", "manual", "smart_rule"}
VALID_NOTE_VISIBILITY_SCOPES = {"internal", "organization", "private"}

CONTACT_FIELD_LIMITS = {
    "party_id": MAX_CONTACT_ID_LENGTH,
    "contact_id": MAX_CONTACT_ID_LENGTH,
    "group_id": MAX_CONTACT_ID_LENGTH,
    "company_party_id": MAX_CONTACT_ID_LENGTH,
    "import_batch_id": MAX_CONTACT_ID_LENGTH,
    "relationship_id": MAX_CONTACT_ID_LENGTH,
    "filename": 240,
    "party_type": MAX_CONTACT_STATUS_LENGTH,
    "display_name": MAX_CONTACT_DISPLAY_NAME_LENGTH,
    "given_name": MAX_CONTACT_NAME_LENGTH,
    "family_name": MAX_CONTACT_NAME_LENGTH,
    "organization_name": MAX_CONTACT_NAME_LENGTH,
    "company_name": MAX_CONTACT_NAME_LENGTH,
    "email": MAX_CONTACT_EMAIL_LENGTH,
    "phone": MAX_CONTACT_PHONE_LENGTH,
    "website": MAX_CONTACT_WEBSITE_LENGTH,
    "address": MAX_CONTACT_ADDRESS_LENGTH,
    "title": MAX_CONTACT_TITLE_LENGTH,
    "birthday": MAX_CONTACT_STATUS_LENGTH,
    "important_date": MAX_CONTACT_STATUS_LENGTH,
    "instant_message": MAX_CONTACT_EMAIL_LENGTH,
    "tags": MAX_CONTACT_WEBSITE_LENGTH,
    "consent_status": MAX_CONTACT_STATUS_LENGTH,
    "allowed_use": MAX_CONTACT_STATUS_LENGTH,
    "confidence_level": MAX_CONTACT_STATUS_LENGTH,
    "name": MAX_CONTACT_GROUP_NAME_LENGTH,
    "group_name": MAX_CONTACT_GROUP_NAME_LENGTH,
    "group_description": MAX_CONTACT_GROUP_DESCRIPTION_LENGTH,
    "note": MAX_CONTACT_NOTE_LENGTH,
    "body": MAX_CONTACT_NOTE_LENGTH,
    "owner_user_id": MAX_CONTACT_ID_LENGTH,
    "team_id": MAX_CONTACT_ID_LENGTH,
    "visibility_scope": MAX_CONTACT_STATUS_LENGTH,
    "client_reference": MAX_CONTACT_REFERENCE_LENGTH,
    "sync_state": MAX_CONTACT_STATUS_LENGTH,
    "review_state": MAX_CONTACT_STATUS_LENGTH,
    "source": MAX_CONTACT_SOURCE_LENGTH,
    "relationship_type": MAX_CONTACT_STATUS_LENGTH,
    "description": MAX_CONTACT_WEBSITE_LENGTH,
    "kind": MAX_CONTACT_STATUS_LENGTH,
}


def clean_text(value: Any) -> str:
    return str(value or "").strip()


def bounded_text(value: Any, field_name: str, max_length: int | None = None) -> str:
    text = clean_text(value)
    limit = max_length or CONTACT_FIELD_LIMITS.get(field_name, MAX_CONTACT_WEBSITE_LENGTH)
    if len(text) > limit:
        raise ValueError(f"{field_name} must be {limit} characters or fewer")
    return text


def contact_visibility_scope(value: Any) -> str:
    scope = bounded_text(value, "visibility_scope") or "organization"
    if scope not in VALID_CONTACT_VISIBILITY_SCOPES:
        raise ValueError("visibility_scope must be one of: organization, private, team")
    return scope


def contact_group_kind(value: Any) -> str:
    kind = bounded_text(value, "kind").lower() or "manual"
    if kind not in VALID_CONTACT_GROUP_KINDS:
        raise ValueError("contact group kind must be one of: business_domain, manual")
    return kind


def contact_group_visibility_scope(value: Any) -> str:
    scope = bounded_text(value, "visibility_scope") or "organization"
    if scope not in VALID_CONTACT_VISIBILITY_SCOPES:
        raise ValueError("contact group visibility_scope must be one of: organization, private, team")
    return scope


def note_visibility_scope(value: Any) -> str:
    scope = bounded_text(value, "visibility_scope") or "internal"
    if scope not in VALID_NOTE_VISIBILITY_SCOPES:
        raise ValueError("note visibility_scope must be one of: internal, organization, private")
    return scope


def validate_contact_payload_lengths(payload: dict[str, Any]) -> None:
    for field_name in CONTACT_FIELD_LIMITS:
        if field_name in payload:
            bounded_text(payload.get(field_name), field_name)


def normalize_match(value: Any) -> str:
    return "".join(ch.lower() for ch in clean_text(value) if ch.isalnum() or ch == "@")


def contact_attrs(payload: dict[str, Any]) -> dict[str, Any]:
    attrs: dict[str, Any] = {}
    for field in CONTACT_ATTR_FIELDS:
        value = bounded_text(payload.get(field), field)
        if field == "phone":
            value = normalize_phone(value)
        if value:
            attrs[field] = value
    return attrs


def has_meaningful_contact_value(payload: dict[str, Any]) -> bool:
    return any(clean_text(payload.get(field)) for field in MEANINGFUL_FIELDS)


def choose_party_type(payload: dict[str, Any]) -> str:
    party_type = bounded_text(payload.get("party_type"), "party_type").lower()
    if party_type in {"person", "organization"}:
        return party_type
    if bounded_text(payload.get("organization_name"), "organization_name") and not (bounded_text(payload.get("given_name"), "given_name") or bounded_text(payload.get("family_name"), "family_name")):
        return "organization"
    return "person"


def choose_display_name(payload: dict[str, Any]) -> str:
    explicit = bounded_text(payload.get("display_name"), "display_name")
    if explicit:
        return explicit
    organization_name = bounded_text(payload.get("organization_name") or payload.get("company_name"), "organization_name")
    if organization_name:
        return organization_name[:MAX_CONTACT_DISPLAY_NAME_LENGTH]
    person_name = " ".join(part for part in (bounded_text(payload.get("given_name"), "given_name"), bounded_text(payload.get("family_name"), "family_name")) if part)
    if person_name:
        return person_name[:MAX_CONTACT_DISPLAY_NAME_LENGTH]
    for field in ("email", "phone", "website", "address", "note"):
        value = bounded_text(payload.get(field), field)
        if field == "phone":
            value = normalize_phone(value)
        if value:
            return value[:MAX_CONTACT_DISPLAY_NAME_LENGTH]
    raise ValueError("at least one meaningful contact field is required")


def review_state_for_payload(payload: dict[str, Any], duplicate_candidates: list[dict[str, str]]) -> str:
    requested = clean_text(payload.get("review_state"))
    if requested in {"ready", "needs_review", "possible_duplicate", "incomplete"}:
        return requested
    if duplicate_candidates:
        return "possible_duplicate"
    if not (clean_text(payload.get("display_name")) or clean_text(payload.get("given_name")) or clean_text(payload.get("family_name")) or clean_text(payload.get("organization_name"))):
        return "incomplete"
    return "ready"
