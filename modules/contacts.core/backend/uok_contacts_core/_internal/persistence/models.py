from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.db import Base
from uok.models_base import new_id, utcnow

from uok_contacts_core._internal.persistence.system_models import (
    ContactActivity,
    ContactConsentRecord,
    ContactCustomFieldDefinition,
    ContactDuplicateCandidate,
    ContactExternalIdentity,
    ContactImportRow,
    ContactSavedView,
    ContactTeam,
    ContactTeamMember,
    PartyCustomFieldValue,
    PartyFact,
    SYSTEM_MODELS,
)


class Party(Base):
    __tablename__ = "parties"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    party_type: Mapped[str] = mapped_column(String(40))
    display_name: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="active")
    review_state: Mapped[str] = mapped_column(String(40), default="ready")
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    visibility_scope: Mapped[str] = mapped_column(String(40), default="organization")
    source: Mapped[str] = mapped_column(String(80), default="manual")
    client_reference: Mapped[str | None] = mapped_column(String(120), nullable=True)
    sync_state: Mapped[str] = mapped_column(String(40), default="server")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    purged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        Index("ix_contacts_core_parties_org_status_review", "organization_id", "status", "review_state"),
        Index("ix_contacts_core_parties_org_display_name", "organization_id", "display_name"),
        Index("ix_contacts_core_parties_org_owner", "organization_id", "owner_user_id"),
    )


class ContactGroup(Base):
    __tablename__ = "contact_groups"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(40), default="manual")
    visibility_scope: Mapped[str] = mapped_column(String(40), default="organization")
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    team_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        UniqueConstraint("organization_id", "name"),
        Index("ix_contacts_core_contact_groups_org_status", "organization_id", "status"),
        Index("ix_contacts_core_contact_groups_org_owner", "organization_id", "owner_user_id"),
    )


class ContactGroupMember(Base):
    __tablename__ = "contact_group_members"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    group_id: Mapped[str] = mapped_column(ForeignKey("contact_groups.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    added_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        UniqueConstraint("organization_id", "group_id", "party_id"),
        Index("ix_contacts_core_group_members_group", "organization_id", "group_id"),
        Index("ix_contacts_core_group_members_party", "organization_id", "party_id"),
    )


class PartyRelationship(Base):
    __tablename__ = "party_relationships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    from_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    to_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    relationship_type: Mapped[str] = mapped_column(String(80))
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        CheckConstraint("from_party_id <> to_party_id", name="ck_contacts_core_relationship_not_self"),
        UniqueConstraint("organization_id", "from_party_id", "to_party_id", "relationship_type"),
        Index("ix_contacts_core_party_relationships_from", "organization_id", "from_party_id"),
        Index("ix_contacts_core_party_relationships_to", "organization_id", "to_party_id"),
    )


class PartyNote(Base):
    __tablename__ = "party_notes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"), index=True)
    author_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    visibility_scope: Mapped[str] = mapped_column(String(40), default="internal")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index("ix_contacts_core_party_notes_party_created", "party_id", "created_at"),
    )


class ContactImportBatch(Base):
    __tablename__ = "contact_import_batches"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    source_filename: Mapped[str] = mapped_column(String(240))
    status: Mapped[str] = mapped_column(String(40), default="completed")
    imported_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (
        Index("ix_contacts_core_import_batches_org_created", "organization_id", "created_at"),
    )


def owned_models() -> dict[str, type]:
    return {
        "ContactGroup": ContactGroup,
        "ContactGroupMember": ContactGroupMember,
        "Party": Party,
        "PartyNote": PartyNote,
        "PartyRelationship": PartyRelationship,
        "ContactImportBatch": ContactImportBatch,
        **SYSTEM_MODELS,
    }


__all__ = [
    "ContactGroup",
    "ContactGroupMember",
    "ContactImportBatch",
    "ContactActivity",
    "ContactConsentRecord",
    "ContactCustomFieldDefinition",
    "ContactDuplicateCandidate",
    "ContactExternalIdentity",
    "ContactImportRow",
    "ContactSavedView",
    "ContactTeam",
    "ContactTeamMember",
    "PartyCustomFieldValue",
    "PartyFact",
    "Party",
    "PartyNote",
    "PartyRelationship",
    "owned_models",
    "utcnow",
]
