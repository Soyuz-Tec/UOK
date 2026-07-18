from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    shipper_party_id: Mapped[str] = mapped_column(String(36))
    consignee_party_id: Mapped[str] = mapped_column(String(36))
    origin_location_id: Mapped[str] = mapped_column(String(36))
    destination_location_id: Mapped[str] = mapped_column(String(36))
    route_definition_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    planned_departure_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_arrival_on: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="draft", server_default="draft")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_shipments_org_code"),
        CheckConstraint(
            "status IN ('draft', 'planned', 'in_transit', 'arrived', 'closed', 'cancelled')",
            name="ck_shipments_status",
        ),
        CheckConstraint("version >= 1", name="ck_shipments_version_positive"),
        CheckConstraint(
            "origin_location_id <> destination_location_id",
            name="ck_shipments_distinct_endpoints",
        ),
        CheckConstraint(
            "planned_departure_on IS NULL OR planned_arrival_on IS NULL "
            "OR planned_arrival_on >= planned_departure_on",
            name="ck_shipments_planned_date_order",
        ),
        Index("ix_shipments_org_status_code", "organization_id", "status", "code"),
        Index("ix_shipments_org_planned_departure", "organization_id", "planned_departure_on"),
        Index("ix_shipments_org_route", "organization_id", "route_definition_id"),
        Index("ix_shipments_org_shipper", "organization_id", "shipper_party_id"),
        Index("ix_shipments_org_consignee", "organization_id", "consignee_party_id"),
    )


class ShipmentStatusHistory(Base):
    __tablename__ = "shipment_status_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("shipments.id"), index=True)
    previous_status: Mapped[str] = mapped_column(String(40))
    new_status: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    version: Mapped[int] = mapped_column(BigInteger)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint("version >= 2", name="ck_shipment_status_history_version"),
        Index(
            "ix_shipment_status_history_org_shipment_changed",
            "organization_id",
            "shipment_id",
            "changed_at",
        ),
    )


class ShipmentDocumentRequirement(Base):
    __tablename__ = "shipment_document_requirements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("shipments.id"), index=True)
    compliance_document_type_id: Mapped[str] = mapped_column(String(36))
    requirement_level: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="missing", server_default="missing")
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "shipment_id",
            "compliance_document_type_id",
            name="uq_shipment_document_requirements_org_shipment_type",
        ),
        CheckConstraint(
            "requirement_level IN ('required', 'optional')",
            name="ck_shipment_document_requirements_level",
        ),
        CheckConstraint(
            "status IN ('missing', 'received', 'waived', 'not_applicable')",
            name="ck_shipment_document_requirements_status",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_shipment_document_requirements_version_positive",
        ),
        Index(
            "ix_shipment_document_requirements_org_shipment_status",
            "organization_id",
            "shipment_id",
            "status",
        ),
        Index(
            "ix_shipment_document_requirements_org_type",
            "organization_id",
            "compliance_document_type_id",
        ),
    )


class ShipmentDocumentRequirementHistory(Base):
    __tablename__ = "shipment_document_requirement_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    shipment_id: Mapped[str] = mapped_column(ForeignKey("shipments.id"), index=True)
    requirement_id: Mapped[str] = mapped_column(String(36), index=True)
    compliance_document_type_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(40))
    requirement_level: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40))
    notes: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger)
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint(
            "action IN ('added', 'updated', 'status_changed', 'removed')",
            name="ck_shipment_document_requirement_history_action",
        ),
        CheckConstraint(
            "requirement_level IN ('required', 'optional')",
            name="ck_shipment_document_requirement_history_level",
        ),
        CheckConstraint(
            "status IN ('missing', 'received', 'waived', 'not_applicable')",
            name="ck_shipment_document_requirement_history_status",
        ),
        CheckConstraint(
            "version >= 1",
            name="ck_shipment_document_requirement_history_version_positive",
        ),
        Index(
            "ix_shipment_document_requirement_history_org_shipment_changed",
            "organization_id",
            "shipment_id",
            "changed_at",
        ),
        Index(
            "ix_shipment_document_requirement_history_org_req_changed",
            "organization_id",
            "requirement_id",
            "changed_at",
        ),
    )


def owned_models() -> dict[str, type]:
    return {
        "Shipment": Shipment,
        "ShipmentDocumentRequirement": ShipmentDocumentRequirement,
        "ShipmentDocumentRequirementHistory": ShipmentDocumentRequirementHistory,
        "ShipmentStatusHistory": ShipmentStatusHistory,
    }


__all__ = [
    "Shipment",
    "ShipmentDocumentRequirement",
    "ShipmentDocumentRequirementHistory",
    "ShipmentStatusHistory",
    "owned_models",
]
