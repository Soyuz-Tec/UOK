from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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


class Calendar(Base):
    __tablename__ = "calendars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    visibility_scope: Mapped[str] = mapped_column(String(40), default="organization")
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    status: Mapped[str] = mapped_column(String(40), default="active")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    calendar_id: Mapped[str] = mapped_column(ForeignKey("calendars.id"), index=True)
    uid: Mapped[str] = mapped_column(String(180))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(240), nullable=True)
    event_type: Mapped[str] = mapped_column(String(40), default="event")
    status: Mapped[str] = mapped_column(String(40), default="confirmed")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    transparency: Mapped[str] = mapped_column(String(40), default="busy")
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recurrence_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_module: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_object_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_object_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("organization_id", "uid"),)


class CalendarEventParticipant(Base):
    __tablename__ = "calendar_event_participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("calendar_events.id"), index=True)
    participant_type: Mapped[str] = mapped_column(String(40))
    participant_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    role: Mapped[str] = mapped_column(String(40), default="required")
    response_status: Mapped[str] = mapped_column(String(40), default="needs_action")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CalendarReminder(Base):
    __tablename__ = "calendar_reminders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("calendar_events.id"), index=True)
    reminder_type: Mapped[str] = mapped_column(String(40), default="in_app")
    trigger_minutes_before: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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


class PartyRelationship(Base):
    __tablename__ = "party_relationships"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    from_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    to_party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"))
    relationship_type: Mapped[str] = mapped_column(String(80))
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PartyNote(Base):
    __tablename__ = "party_notes"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"))
    party_id: Mapped[str] = mapped_column(ForeignKey("parties.id"), index=True)
    author_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    visibility_scope: Mapped[str] = mapped_column(String(40), default="internal")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


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
