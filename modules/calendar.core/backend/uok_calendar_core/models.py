from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.db import Base
from uok.models_base import new_id, utcnow


class Calendar(Base):
    __tablename__ = "calendars"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    owner_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(160))
    color: Mapped[str | None] = mapped_column(String(32), nullable=True)
    visibility_scope: Mapped[str] = mapped_column(String(40), default="organization")
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    status: Mapped[str] = mapped_column(String(40), default="active")
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CalendarEvent(Base):
    __tablename__ = "calendar_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    calendar_id: Mapped[str] = mapped_column(ForeignKey("calendars.id"), index=True)
    uid: Mapped[str] = mapped_column(String(180))
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(240), nullable=True)
    event_type: Mapped[str] = mapped_column(String(40), default="event")
    status: Mapped[str] = mapped_column(String(40), default="confirmed")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    transparency: Mapped[str] = mapped_column(String(40), default="busy")
    recurrence_rule: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recurrence_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_module: Mapped[str | None] = mapped_column(String(120), nullable=True)
    source_object_type: Mapped[str | None] = mapped_column(String(80), nullable=True)
    source_object_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    attrs_json: Mapped[str] = mapped_column(Text, default="{}")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    __table_args__ = (UniqueConstraint("organization_id", "uid"),)


class CalendarEventParticipant(Base):
    __tablename__ = "calendar_event_participants"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("calendar_events.id"), index=True)
    participant_type: Mapped[str] = mapped_column(String(40))
    participant_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    email: Mapped[str | None] = mapped_column(String(254), nullable=True)
    display_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    role: Mapped[str] = mapped_column(String(40), default="required")
    response_status: Mapped[str] = mapped_column(String(40), default="needs_action")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CalendarReminder(Base):
    __tablename__ = "calendar_reminders"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("calendar_events.id"), index=True)
    reminder_type: Mapped[str] = mapped_column(String(40), default="in_app")
    trigger_minutes_before: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(40), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


def owned_models() -> dict[str, type]:
    return {
        "Calendar": Calendar,
        "CalendarEvent": CalendarEvent,
        "CalendarEventParticipant": CalendarEventParticipant,
        "CalendarReminder": CalendarReminder,
    }


__all__ = [
    "Calendar",
    "CalendarEvent",
    "CalendarEventParticipant",
    "CalendarReminder",
    "owned_models",
    "utcnow",
]
