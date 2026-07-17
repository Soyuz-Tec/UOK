from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class LocationDefinition(Base):
    __tablename__ = "location_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    canonical_name: Mapped[str] = mapped_column(String(180))
    location_type: Mapped[str] = mapped_column(String(40))
    country_code: Mapped[str] = mapped_column(String(2))
    status: Mapped[str] = mapped_column(String(40), default="active", server_default="active")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_location_definitions_org_code"),
        CheckConstraint(
            "location_type IN ('port', 'warehouse', 'city', 'region')",
            name="ck_location_definitions_type",
        ),
        CheckConstraint("status IN ('active', 'archived')", name="ck_location_definitions_status"),
        CheckConstraint("version >= 1", name="ck_location_definitions_version_positive"),
        Index("ix_location_definitions_org_status_name", "organization_id", "status", "canonical_name"),
        Index("ix_location_definitions_org_type_country", "organization_id", "location_type", "country_code"),
    )


class LocationNameHistory(Base):
    __tablename__ = "location_name_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    location_definition_id: Mapped[str] = mapped_column(ForeignKey("location_definitions.id"), index=True)
    previous_name: Mapped[str] = mapped_column(String(180))
    new_name: Mapped[str] = mapped_column(String(180))
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index(
            "ix_location_name_history_org_location_changed",
            "organization_id",
            "location_definition_id",
            "changed_at",
        ),
    )


def owned_models() -> dict[str, type]:
    return {
        "LocationDefinition": LocationDefinition,
        "LocationNameHistory": LocationNameHistory,
    }


__all__ = ["LocationDefinition", "LocationNameHistory", "owned_models"]
