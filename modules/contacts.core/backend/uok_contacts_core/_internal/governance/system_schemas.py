from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ContactFactWriteRequest(BaseModel):
    fact_type: str = Field(..., min_length=1, max_length=40)
    label: str = Field(default="work", min_length=1, max_length=60)
    value: str = Field(..., min_length=1, max_length=4_000)
    details: dict[str, Any] = Field(default_factory=dict)
    is_primary: bool = False
    is_verified: bool = False
    source: str = Field(default="manual", min_length=1, max_length=80)
    confidence: str = Field(default="unknown", min_length=1, max_length=40)


class ContactConsentWriteRequest(BaseModel):
    purpose: str = Field(..., min_length=1, max_length=80)
    channel: str = Field(..., min_length=1, max_length=40)
    status: str = Field(..., min_length=1, max_length=40)
    legal_basis: str = Field(default="unspecified", max_length=80)
    allowed_use: str = Field(default="", max_length=120)
    source: str = Field(default="manual", max_length=80)
    evidence: dict[str, Any] = Field(default_factory=dict)
    effective_at: datetime | None = None
    expires_at: datetime | None = None


class ContactTeamWriteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=2_000)


class ContactTeamMemberRequest(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=80)
    role: str = Field(default="member", pattern="^(owner|manager|member|viewer)$")


class ContactLifecycleReasonRequest(BaseModel):
    reason: str = Field(..., min_length=3, max_length=500)


class ContactSavedViewWriteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    visibility_scope: str = Field(default="personal", pattern="^(personal|organization)$")
    is_pinned: bool = False
    query: dict[str, Any] = Field(default_factory=dict)


class ContactDuplicateResolutionRequest(BaseModel):
    status: str = Field(..., pattern="^(not_duplicate|ignored)$")
    expected_updated_at: datetime | None = None


class ContactBulkActionRequest(BaseModel):
    party_ids: list[str] = Field(..., min_length=1, max_length=200)
    action: str = Field(..., pattern="^(archive|restore|assign_team|add_to_group|add_tag)$")
    value: str | None = Field(default=None, max_length=240)


class ContactExternalIdentityWriteRequest(BaseModel):
    provider: str = Field(..., min_length=1, max_length=80)
    external_id: str = Field(..., min_length=1, max_length=240)
    sync_state: str = Field(default="linked", max_length=40)
    etag: str | None = Field(default=None, max_length=240)
    attributes: dict[str, Any] = Field(default_factory=dict)


class ContactCustomFieldDefinitionRequest(BaseModel):
    field_key: str = Field(..., pattern="^[a-z][a-z0-9_]{1,79}$")
    label: str = Field(..., min_length=1, max_length=120)
    field_type: str = Field(..., pattern="^(text|number|date|boolean|choice|url)$")
    applies_to: str = Field(default="all", pattern="^(all|person|organization)$")
    required: bool = False
    options: list[str] = Field(default_factory=list, max_length=100)


class ContactCustomFieldValueRequest(BaseModel):
    value: Any


class ContactVCardImportRequest(BaseModel):
    vcard_text: str = Field(..., min_length=1, max_length=2_000_000)
    dry_run: bool = False
