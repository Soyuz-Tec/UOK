from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from uok.db import Base
from uok.models_base import new_id, utcnow


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


def owned_models() -> dict[str, type]:
    return {"ReportArtifact": ReportArtifact}


__all__ = ["ReportArtifact", "owned_models", "utcnow"]
