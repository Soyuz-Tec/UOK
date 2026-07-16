from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class CommunicationThread(Base):
    __tablename__ = "communication_threads"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="open", server_default="open")
    context_type: Mapped[str] = mapped_column(String(80), default="general", server_default="general")
    context_id: Mapped[str | None] = mapped_column(String(180), nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    revision: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_from_status: Mapped[str | None] = mapped_column(String(40), nullable=True)
    __table_args__ = (
        CheckConstraint("status IN ('open', 'closed', 'archived')", name="ck_communication_thread_status"),
        CheckConstraint("revision >= 1", name="ck_communication_thread_revision_positive"),
        CheckConstraint(
            "(status = 'archived' AND archived_from_status IN ('open', 'closed')) OR "
            "(status IN ('open', 'closed') AND archived_from_status IS NULL)",
            name="ck_communication_thread_archive_state",
        ),
        Index("ix_communication_threads_org_updated", "organization_id", "updated_at"),
        Index("ix_communication_threads_org_context", "organization_id", "context_type", "context_id"),
    )


def owned_models() -> dict[str, type]:
    return {"CommunicationThread": CommunicationThread}


__all__ = ["CommunicationThread", "owned_models", "utcnow"]
