from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class ContactTeam(Base):
    __tablename__ = "contact_teams"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        Index("ix_contacts_core_teams_org_status", "organization_id", "status"),
    )


class ContactTeamMember(Base):
    __tablename__ = "contact_team_members"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    team_id: Mapped[str] = mapped_column(ForeignKey("contact_teams.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(40), default="member")
    status: Mapped[str] = mapped_column(String(40), default="active")
    added_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "team_id", "user_id"),
        Index("ix_contacts_core_team_members_user", "organization_id", "user_id", "status"),
        Index("ix_contacts_core_team_members_team", "organization_id", "team_id", "status"),
    )


class PartyFact(Base):
    __tablename__ = "party_facts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    fact_type: Mapped[str] = mapped_column(String(40))
    label: Mapped[str] = mapped_column(String(60), default="work")
    value_text: Mapped[str] = mapped_column(Text)
    normalized_value: Mapped[str] = mapped_column(String(512), default="")
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String(80), default="manual")
    confidence: Mapped[str] = mapped_column(String(40), default="unknown")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "party_id", "fact_type", "label", "normalized_value"),
        Index("ix_contacts_core_party_facts_party_type", "organization_id", "party_id", "fact_type"),
        Index("ix_contacts_core_party_facts_normalized", "organization_id", "fact_type", "normalized_value"),
    )


class ContactConsentRecord(Base):
    __tablename__ = "contact_consent_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    purpose: Mapped[str] = mapped_column(String(80))
    channel: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40))
    legal_basis: Mapped[str] = mapped_column(String(80), default="unspecified")
    allowed_use: Mapped[str] = mapped_column(String(120), default="")
    source: Mapped[str] = mapped_column(String(80), default="manual")
    evidence_json: Mapped[str] = mapped_column(Text, default="{}")
    effective_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index("ix_contacts_core_consent_party_created", "organization_id", "party_id", "created_at"),
        Index("ix_contacts_core_consent_policy", "organization_id", "purpose", "channel", "status"),
    )


class ContactImportRow(Base):
    __tablename__ = "contact_import_rows"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    batch_id: Mapped[str] = mapped_column(ForeignKey("contact_import_batches.id"))
    row_number: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    requested_operation: Mapped[str] = mapped_column(String(40), default="create")
    applied_operation: Mapped[str] = mapped_column(String(40), default="none")
    status: Mapped[str] = mapped_column(String(40), default="pending")
    party_id: Mapped[str | None] = mapped_column(ForeignKey("parties.id"), nullable=True)
    matched_party_id: Mapped[str | None] = mapped_column(ForeignKey("parties.id"), nullable=True)
    error_code: Mapped[str | None] = mapped_column(String(80), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, default="")
    input_json: Mapped[str] = mapped_column(Text, default="{}")
    result_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "batch_id", "row_number"),
        Index("ix_contacts_core_import_rows_batch_status", "organization_id", "batch_id", "status"),
        Index("ix_contacts_core_import_rows_checksum", "organization_id", "checksum"),
    )


class ContactDuplicateCandidate(Base):
    __tablename__ = "contact_duplicate_candidates"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    left_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    right_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    score: Mapped[int] = mapped_column(Integer)
    reasons_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(40), default="open")
    resolved_by_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "left_party_id", "right_party_id"),
        Index("ix_contacts_core_duplicate_candidates_queue", "organization_id", "status", "score"),
    )


class ContactSavedView(Base):
    __tablename__ = "contact_saved_views"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    visibility_scope: Mapped[str] = mapped_column(String(40), default="personal")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    query_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "owner_user_id", "name"),
        Index("ix_contacts_core_saved_views_owner", "organization_id", "owner_user_id", "is_pinned"),
    )


class ContactActivity(Base):
    __tablename__ = "contact_activities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    actor_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    activity_type: Mapped[str] = mapped_column(String(80))
    object_type: Mapped[str] = mapped_column(String(80), default="Party")
    object_id: Mapped[str] = mapped_column(String(80))
    summary: Mapped[str] = mapped_column(String(240))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index("ix_contacts_core_activity_party_time", "organization_id", "party_id", "occurred_at"),
    )


class ContactExternalIdentity(Base):
    __tablename__ = "contact_external_identities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    provider: Mapped[str] = mapped_column(String(80))
    external_id: Mapped[str] = mapped_column(String(240))
    sync_state: Mapped[str] = mapped_column(String(40), default="linked")
    conflict_state: Mapped[str] = mapped_column(String(40), default="none")
    etag: Mapped[str | None] = mapped_column(String(240), nullable=True)
    sync_cursor: Mapped[str | None] = mapped_column(Text, nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "provider", "external_id"),
        Index("ix_contacts_core_external_party", "organization_id", "party_id", "provider"),
    )


class ContactCustomFieldDefinition(Base):
    __tablename__ = "contact_custom_field_definitions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    field_key: Mapped[str] = mapped_column(String(80))
    label: Mapped[str] = mapped_column(String(120))
    field_type: Mapped[str] = mapped_column(String(40))
    applies_to: Mapped[str] = mapped_column(String(40), default="all")
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    options_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "field_key"),
        Index("ix_contacts_core_custom_fields_status", "organization_id", "status"),
    )


class PartyCustomFieldValue(Base):
    __tablename__ = "party_custom_field_values"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    field_definition_id: Mapped[str] = mapped_column(ForeignKey("contact_custom_field_definitions.id"))
    value_json: Mapped[str] = mapped_column(Text, default="null")
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "party_id", "field_definition_id"),
        Index("ix_contacts_core_custom_values_party", "organization_id", "party_id"),
    )


SYSTEM_MODELS = {
    model.__name__: model
    for model in (
        ContactTeam,
        ContactTeamMember,
        PartyFact,
        ContactConsentRecord,
        ContactImportRow,
        ContactDuplicateCandidate,
        ContactSavedView,
        ContactActivity,
        ContactExternalIdentity,
        ContactCustomFieldDefinition,
        PartyCustomFieldValue,
    )
}

__all__ = [*SYSTEM_MODELS, "SYSTEM_MODELS"]
