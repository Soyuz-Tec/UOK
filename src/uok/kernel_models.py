from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .kernel.persistence import Base
from .models_base import new_id, utcnow


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


KERNEL_MODELS = {
    model.__name__: model
    for model in (
        Organization,
        User,
        Membership,
        SchemaVersion,
        GovernanceRule,
        ModuleRecord,
        WorkflowInstance,
        CommandLog,
        EventRecord,
    )
}

__all__ = [*KERNEL_MODELS, "KERNEL_MODELS"]
