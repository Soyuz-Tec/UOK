from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from uok.security import Actor
from uok.util import dumps, row_dict

from .command_support import _emit_event, _party
from .models import utcnow
from .system_command_support import (
    bounded_mapping,
    bounded_text,
    record_activity,
    serialize_custom_field_definition,
    validated_custom_field_value,
)
from .system_models import ContactCustomFieldDefinition, ContactExternalIdentity, PartyCustomFieldValue

CUSTOM_FIELD_TYPES = {"boolean", "choice", "date", "number", "text", "url"}
CUSTOM_FIELD_APPLIES_TO = {"all", "organization", "person"}
CUSTOM_FIELD_KEY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{1,79}$")


def cmd_link_external_identity(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id"), 80), "party_id")
    provider = bounded_text(payload.get("provider"), 80).lower()
    external_id = bounded_text(payload.get("external_id"), 240)
    if not provider or not external_id:
        raise ValueError("provider and external_id are required")
    row = db.scalar(select(ContactExternalIdentity).where(
        ContactExternalIdentity.organization_id == actor.organization_id,
        ContactExternalIdentity.provider == provider,
        ContactExternalIdentity.external_id == external_id,
    ))
    now = utcnow()
    if row and row.party_id != party.id:
        raise ValueError("external contact identity is already linked")
    if not row:
        row = ContactExternalIdentity(
            organization_id=actor.organization_id,
            party_id=party.id,
            provider=provider,
            external_id=external_id,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    row.sync_state = bounded_text(payload.get("sync_state") or "linked", 40)
    row.etag = bounded_text(payload.get("etag"), 240) or None
    row.attrs_json = dumps(bounded_mapping(payload.get("attributes")))
    row.updated_at = now
    db.flush()
    record_activity(db, actor, party.id, "external_identity_linked", "ContactExternalIdentity", row.id, f"Linked {provider} identity", {"provider": provider})
    _emit_event(db, actor, "ContactExternalIdentityLinked", "ContactExternalIdentity", row.id, {"party_id": party.id, "provider": provider})
    return row_dict(row)


def cmd_define_contact_custom_field(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    field_key = bounded_text(payload.get("field_key"), 80)
    if not CUSTOM_FIELD_KEY_PATTERN.fullmatch(field_key):
        raise ValueError("custom field key must match ^[a-z][a-z0-9_]{1,79}$")
    label = bounded_text(payload.get("label"), 120)
    if not label:
        raise ValueError("custom field label is required")
    field_type = bounded_text(payload.get("field_type"), 40)
    if field_type not in CUSTOM_FIELD_TYPES:
        raise ValueError(f"custom field type must be one of: {', '.join(sorted(CUSTOM_FIELD_TYPES))}")
    applies_to = bounded_text(payload.get("applies_to") or "all", 40)
    if applies_to not in CUSTOM_FIELD_APPLIES_TO:
        raise ValueError(f"custom field applies_to must be one of: {', '.join(sorted(CUSTOM_FIELD_APPLIES_TO))}")
    options = _custom_field_options(payload.get("options"))
    existing = db.scalar(select(ContactCustomFieldDefinition).where(
        ContactCustomFieldDefinition.organization_id == actor.organization_id,
        ContactCustomFieldDefinition.field_key == field_key,
    ))
    now = utcnow()
    if not existing:
        existing = ContactCustomFieldDefinition(
            organization_id=actor.organization_id,
            field_key=field_key,
            created_by_user_id=actor.user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(existing)
    elif existing.status == "archived":
        raise ValueError("custom field definition is archived; use RestoreContactCustomField")
    existing.label = label
    existing.field_type = field_type
    existing.applies_to = applies_to
    existing.required = bool(payload.get("required"))
    existing.options_json = dumps(options)
    existing.status = "active"
    existing.updated_at = now
    db.flush()
    _emit_event(db, actor, "ContactCustomFieldDefined", "ContactCustomFieldDefinition", existing.id, {"field_key": field_key})
    return serialize_custom_field_definition(actor, existing)


def _custom_field_options(value: Any) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("custom field options must be a list")
    if len(value) > 100:
        raise ValueError("custom field options must contain 100 entries or fewer")
    if any(not isinstance(option, str) for option in value):
        raise ValueError("custom field options must contain only text values")
    return value


def cmd_set_contact_custom_field(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    party = _party(db, actor, bounded_text(payload.get("party_id"), 80), "party_id")
    definition = db.get(ContactCustomFieldDefinition, bounded_text(payload.get("field_definition_id"), 80))
    if not definition or definition.organization_id != actor.organization_id or definition.status != "active":
        raise ValueError("custom field definition not found")
    if definition.applies_to not in {"all", party.party_type}:
        raise ValueError("custom field does not apply to this contact type")
    value = validated_custom_field_value(definition, payload.get("value"))
    now = utcnow()
    row = db.scalar(select(PartyCustomFieldValue).where(
        PartyCustomFieldValue.organization_id == actor.organization_id,
        PartyCustomFieldValue.party_id == party.id,
        PartyCustomFieldValue.field_definition_id == definition.id,
    ))
    if not row:
        row = PartyCustomFieldValue(
            organization_id=actor.organization_id,
            party_id=party.id,
            field_definition_id=definition.id,
            updated_by_user_id=actor.user_id,
            created_at=now,
            updated_at=now,
        )
        db.add(row)
    row.value_json = dumps(value)
    row.updated_by_user_id = actor.user_id
    row.updated_at = now
    db.flush()
    record_activity(db, actor, party.id, "custom_field_updated", "PartyCustomFieldValue", row.id, f"Updated {definition.label}", {"field_key": definition.field_key})
    _emit_event(db, actor, "ContactCustomFieldValueSet", "PartyCustomFieldValue", row.id, {"party_id": party.id, "field_key": definition.field_key})
    return row_dict(row, {
        "field_key": definition.field_key,
        "label": definition.label,
        "field_type": definition.field_type,
    })
