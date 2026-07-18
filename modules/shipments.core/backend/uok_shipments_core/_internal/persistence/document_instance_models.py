from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class ShipmentDocumentInstance(Base):
    __tablename__ = "shipment_document_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("shipments.id"), index=True)
    compliance_document_type_id: Mapped[str] = mapped_column(String(36))
    requirement_id: Mapped[str | None] = mapped_column(
        ForeignKey("shipment_document_requirements.id"),
        nullable=True,
        index=True,
    )
    document_number: Mapped[str] = mapped_column(String(160))
    issuing_party_name: Mapped[str | None] = mapped_column(String(240), nullable=True)
    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="draft", server_default="draft")
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'recorded', 'verified', 'rejected', 'superseded')",
            name="ck_shipment_document_instances_status",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_shipment_document_instances_version_positive",
        ),
        CheckConstraint(
            "issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on",
            name="ck_shipment_document_instances_date_order",
        ),
        Index(
            "ix_shipment_document_instances_org_shipment_status",
            "organization_id",
            "shipment_id",
            "status",
        ),
        Index(
            "ix_shipment_document_instances_org_type",
            "organization_id",
            "compliance_document_type_id",
        ),
        Index(
            "ix_shipment_document_instances_org_requirement",
            "organization_id",
            "requirement_id",
        ),
    )


class ShipmentDocumentInstanceHistory(Base):
    __tablename__ = "shipment_document_instance_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("shipments.id"), index=True)
    instance_id: Mapped[str] = mapped_column(String(36), index=True)
    compliance_document_type_id: Mapped[str] = mapped_column(String(36))
    requirement_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    document_number: Mapped[str] = mapped_column(String(160))
    issuing_party_name: Mapped[str | None] = mapped_column(String(240), nullable=True)
    issued_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    expires_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    action: Mapped[str] = mapped_column(String(40))
    version: Mapped[int] = mapped_column(BigInteger)
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint(
            "status IN ('draft', 'recorded', 'verified', 'rejected', 'superseded')",
            name="ck_shipment_document_instance_history_status",
        ),
        CheckConstraint(
            "action IN ('created', 'updated', 'status_changed')",
            name="ck_shipment_document_instance_history_action",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_shipment_document_instance_history_version_positive",
        ),
        CheckConstraint(
            "issued_on IS NULL OR expires_on IS NULL OR expires_on >= issued_on",
            name="ck_shipment_document_instance_history_date_order",
        ),
        Index(
            "ix_shipment_document_instance_history_org_shipment_changed",
            "organization_id",
            "shipment_id",
            "changed_at",
        ),
        Index(
            "ix_shipment_document_instance_history_org_instance_changed",
            "organization_id",
            "instance_id",
            "changed_at",
        ),
    )


__all__ = [
    "ShipmentDocumentInstance",
    "ShipmentDocumentInstanceHistory",
]
