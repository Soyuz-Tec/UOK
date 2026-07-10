from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .models_base import new_id, utcnow


class CommunicationThread(Base):
    __tablename__ = "communication_threads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="open", server_default="open")
    context_type: Mapped[str] = mapped_column(String(80), default="general", server_default="general")
    context_id: Mapped[str | None] = mapped_column(String(180), nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (
        CheckConstraint("status IN ('open', 'closed', 'archived')", name="ck_communication_thread_status"),
        Index("ix_communication_threads_org_updated", "organization_id", "updated_at"),
        Index("ix_communication_threads_org_context", "organization_id", "context_type", "context_id"),
    )
