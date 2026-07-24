from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class RouteDefinition(Base):
    __tablename__ = "route_definitions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    code: Mapped[str] = mapped_column(String(80))
    canonical_name: Mapped[str] = mapped_column(String(180))
    mode_hint: Mapped[str | None] = mapped_column(String(40), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active", server_default="active")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_route_definitions_org_code"),
        CheckConstraint(
            "mode_hint IS NULL OR mode_hint IN ('sea', 'road', 'rail', 'air', 'multimodal')",
            name="ck_route_definitions_mode_hint",
        ),
        CheckConstraint("status IN ('active', 'archived')", name="ck_route_definitions_status"),
        CheckConstraint("version >= 1", name="ck_route_definitions_version_positive"),
        Index("ix_route_definitions_org_status_name", "organization_id", "status", "canonical_name"),
        Index("ix_route_definitions_org_mode", "organization_id", "mode_hint"),
    )


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    route_definition_id: Mapped[str] = mapped_column(ForeignKey("route_definitions.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    stop_role: Mapped[str] = mapped_column(String(40))
    location_definition_id: Mapped[str] = mapped_column(String(36))

    __table_args__ = (
        UniqueConstraint(
            "organization_id", "route_definition_id", "sequence", name="uq_route_stops_org_route_sequence"
        ),
        UniqueConstraint(
            "organization_id",
            "route_definition_id",
            "location_definition_id",
            name="uq_route_stops_org_route_location",
        ),
        CheckConstraint("sequence >= 0 AND sequence <= 9", name="ck_route_stops_sequence"),
        CheckConstraint(
            "stop_role IN ('origin', 'waypoint', 'destination')",
            name="ck_route_stops_role",
        ),
        Index("ix_route_stops_org_route_sequence", "organization_id", "route_definition_id", "sequence"),
        Index("ix_route_stops_org_location", "organization_id", "location_definition_id"),
    )


class RouteNameHistory(Base):
    __tablename__ = "route_name_history"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    route_definition_id: Mapped[str] = mapped_column(ForeignKey("route_definitions.id"), index=True)
    previous_name: Mapped[str] = mapped_column(String(180))
    new_name: Mapped[str] = mapped_column(String(180))
    reason: Mapped[str] = mapped_column(String(500))
    changed_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index(
            "ix_route_name_history_org_route_changed",
            "organization_id",
            "route_definition_id",
            "changed_at",
        ),
    )


def owned_models() -> dict[str, type]:
    return {
        "RouteDefinition": RouteDefinition,
        "RouteStop": RouteStop,
        "RouteNameHistory": RouteNameHistory,
    }


__all__ = ["RouteDefinition", "RouteNameHistory", "RouteStop", "owned_models"]
