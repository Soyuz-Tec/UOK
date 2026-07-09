from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def new_id() -> str:
    return str(uuid4())


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), unique=True)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(128))
    display_name: Mapped[str] = mapped_column(String(160))


class Membership(Base):
    __tablename__ = "memberships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    role: Mapped[str] = mapped_column(String(80))
    user: Mapped[User] = relationship()
    organization: Mapped[Organization] = relationship()


class SchemaVersion(Base):
    __tablename__ = "schema_versions"
    version: Mapped[str] = mapped_column(String(80), primary_key=True)
    note: Mapped[str] = mapped_column(Text)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class GovernanceRule(Base):
    __tablename__ = "governance_rules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    rule_name: Mapped[str] = mapped_column(String(160))
    domain: Mapped[str] = mapped_column(String(80))
    owner_role: Mapped[str] = mapped_column(String(80))
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    __table_args__ = (UniqueConstraint("organization_id", "rule_name"),)


class ModuleRecord(Base):
    __tablename__ = "modules"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[str] = mapped_column(String(80))
    version: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(40), default="installed")
    manifest_json: Mapped[str] = mapped_column(Text)
    __table_args__ = (UniqueConstraint("organization_id", "name"),)


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


from .planning_models import (  # noqa: E402
    PlanningAssignment,
    PlanningBaseline,
    PlanningCalendar,
    PlanningProject,
    PlanningResource,
    PlanningScheduleEvent,
    PlanningTask,
    PlanningTaskDependency,
)


class ReportArtifact(Base):
    __tablename__ = "report_artifacts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    source_module: Mapped[str] = mapped_column(String(120))
    template_key: Mapped[str] = mapped_column(String(160))
    artifact_kind: Mapped[str] = mapped_column(String(80), default="report")
    format: Mapped[str] = mapped_column(String(20))
    filename: Mapped[str] = mapped_column(String(240))
    media_type: Mapped[str] = mapped_column(String(120))
    storage_key: Mapped[str] = mapped_column(String(360))
    content_sha256: Mapped[str] = mapped_column(String(64))
    byte_size: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="generated")
    metadata_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class WorkflowInstance(Base):
    __tablename__ = "workflow_instances"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    workflow_name: Mapped[str] = mapped_column(String(100))
    object_type: Mapped[str] = mapped_column(String(80))
    object_id: Mapped[str] = mapped_column(String(36))
    state: Mapped[str] = mapped_column(String(80))
    history_json: Mapped[str] = mapped_column(Text, default="[]")


class CommandLog(Base):
    __tablename__ = "command_logs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    command_type: Mapped[str] = mapped_column(String(120), index=True)
    idempotency_key: Mapped[str] = mapped_column(String(200), index=True)
    status: Mapped[str] = mapped_column(String(40))
    request_json: Mapped[str] = mapped_column(Text, default="{}")
    response_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    __table_args__ = (UniqueConstraint("organization_id", "idempotency_key"),)


class EventRecord(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    event_type: Mapped[str] = mapped_column(String(120))
    object_type: Mapped[str] = mapped_column(String(80))
    object_id: Mapped[str] = mapped_column(String(80))
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
