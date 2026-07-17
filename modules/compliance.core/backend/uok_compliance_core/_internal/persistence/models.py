from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class ComplianceDocumentType(Base):
    __tablename__ = "compliance_document_types"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    canonical_name: Mapped[str] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    category: Mapped[str | None] = mapped_column(String(120), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active", server_default="active")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "code",
            name="uq_compliance_document_types_org_code",
        ),
        CheckConstraint(
            "status IN ('active', 'inactive', 'archived')",
            name="ck_compliance_document_types_status",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_compliance_document_types_version_positive",
        ),
        Index(
            "ix_compliance_document_types_org_status_name",
            "organization_id",
            "status",
            "canonical_name",
        ),
        Index(
            "ix_compliance_document_types_org_category",
            "organization_id",
            "category",
        ),
    )


class ComplianceDocumentTypeNameHistory(Base):
    __tablename__ = "compliance_document_type_name_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    compliance_document_type_id: Mapped[str] = mapped_column(
        ForeignKey("compliance_document_types.id"),
        index=True,
    )
    previous_name: Mapped[str] = mapped_column(String(180))
    new_name: Mapped[str] = mapped_column(String(180))
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index(
            "ix_compliance_document_type_name_history_org_type_changed",
            "organization_id",
            "compliance_document_type_id",
            "changed_at",
        ),
    )


def owned_models() -> dict[str, type]:
    return {
        "ComplianceDocumentType": ComplianceDocumentType,
        "ComplianceDocumentTypeNameHistory": ComplianceDocumentTypeNameHistory,
    }


__all__ = [
    "ComplianceDocumentType",
    "ComplianceDocumentTypeNameHistory",
    "owned_models",
]
