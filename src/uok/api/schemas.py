from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from ..commands import MAX_IDEMPOTENCY_KEY_LENGTH
from ..contacts import (
    MAX_CONTACT_ADDRESS_LENGTH,
    MAX_CONTACT_DISPLAY_NAME_LENGTH,
    MAX_CONTACT_EMAIL_LENGTH,
    MAX_CONTACT_ID_LENGTH,
    MAX_CONTACT_NAME_LENGTH,
    MAX_CONTACT_NOTE_LENGTH,
    MAX_CONTACT_PHONE_LENGTH,
    MAX_CONTACT_REFERENCE_LENGTH,
    MAX_CONTACT_STATUS_LENGTH,
    MAX_CONTACT_TITLE_LENGTH,
    MAX_CONTACT_WEBSITE_LENGTH,
    MAX_CSV_IMPORT_BYTES,
)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)


class CommandRequest(BaseModel):
    command_type: str = Field(..., max_length=120, examples=["CreateContact"])
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=MAX_IDEMPOTENCY_KEY_LENGTH)


class ContactWriteRequest(BaseModel):
    party_type: str | None = Field(default=None, max_length=MAX_CONTACT_STATUS_LENGTH)
    display_name: str | None = Field(default=None, max_length=MAX_CONTACT_DISPLAY_NAME_LENGTH)
    given_name: str | None = Field(default=None, max_length=MAX_CONTACT_NAME_LENGTH)
    family_name: str | None = Field(default=None, max_length=MAX_CONTACT_NAME_LENGTH)
    organization_name: str | None = Field(default=None, max_length=MAX_CONTACT_NAME_LENGTH)
    company_name: str | None = Field(default=None, max_length=MAX_CONTACT_NAME_LENGTH)
    company_party_id: str | None = Field(default=None, max_length=MAX_CONTACT_ID_LENGTH)
    email: str | None = Field(default=None, max_length=MAX_CONTACT_EMAIL_LENGTH)
    phone: str | None = Field(default=None, max_length=MAX_CONTACT_PHONE_LENGTH)
    website: str | None = Field(default=None, max_length=MAX_CONTACT_WEBSITE_LENGTH)
    address: str | None = Field(default=None, max_length=MAX_CONTACT_ADDRESS_LENGTH)
    title: str | None = Field(default=None, max_length=MAX_CONTACT_TITLE_LENGTH)
    note: str | None = Field(default=None, max_length=MAX_CONTACT_NOTE_LENGTH)
    owner_user_id: str | None = Field(default=None, max_length=MAX_CONTACT_ID_LENGTH)
    team_id: str | None = Field(default=None, max_length=MAX_CONTACT_ID_LENGTH)
    visibility_scope: str | None = Field(default=None, max_length=MAX_CONTACT_STATUS_LENGTH)
    client_reference: str | None = Field(default=None, max_length=MAX_CONTACT_REFERENCE_LENGTH)
    sync_state: str | None = Field(default=None, max_length=MAX_CONTACT_STATUS_LENGTH)
    review_state: str | None = Field(default=None, max_length=MAX_CONTACT_STATUS_LENGTH)


class ContactNoteRequest(BaseModel):
    body: str = Field(..., min_length=1, max_length=MAX_CONTACT_NOTE_LENGTH)
    visibility_scope: str | None = Field(default=None, max_length=MAX_CONTACT_STATUS_LENGTH)


class ContactRelationshipRequest(BaseModel):
    from_party_id: str = Field(..., max_length=MAX_CONTACT_ID_LENGTH)
    to_party_id: str = Field(..., max_length=MAX_CONTACT_ID_LENGTH)
    relationship_type: str = Field(..., min_length=1, max_length=MAX_CONTACT_STATUS_LENGTH)
    description: str | None = Field(default=None, max_length=MAX_CONTACT_WEBSITE_LENGTH)


class ContactCsvImportRequest(BaseModel):
    filename: str | None = Field(default=None, max_length=240)
    csv_text: str = Field(..., min_length=1, max_length=MAX_CSV_IMPORT_BYTES)
