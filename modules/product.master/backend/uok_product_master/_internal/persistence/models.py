from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class ProductDefinition(Base):
    __tablename__ = "product_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    canonical_name: Mapped[str] = mapped_column(String(180))
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    grade: Mapped[str | None] = mapped_column(String(120), nullable=True)
    specification: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_unit_code: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active", server_default="active")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_product_definitions_org_code"),
        CheckConstraint("status IN ('active', 'archived')", name="ck_product_definitions_status"),
        CheckConstraint("version >= 1", name="ck_product_definitions_version_positive"),
        Index("ix_product_definitions_org_status_name", "organization_id", "status", "canonical_name"),
        Index("ix_product_definitions_org_category_grade", "organization_id", "category", "grade"),
    )


class ProductNameHistory(Base):
    __tablename__ = "product_name_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    product_definition_id: Mapped[str] = mapped_column(ForeignKey("product_definitions.id"), index=True)
    previous_name: Mapped[str] = mapped_column(String(180))
    new_name: Mapped[str] = mapped_column(String(180))
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index(
            "ix_product_name_history_org_product_changed",
            "organization_id",
            "product_definition_id",
            "changed_at",
        ),
    )


def owned_models() -> dict[str, type]:
    return {
        "ProductDefinition": ProductDefinition,
        "ProductNameHistory": ProductNameHistory,
    }


__all__ = ["ProductDefinition", "ProductNameHistory", "owned_models"]
