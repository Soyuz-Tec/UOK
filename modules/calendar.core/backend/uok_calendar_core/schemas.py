from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class CalendarWriteRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    color: str | None = Field(default=None, max_length=32)
    visibility_scope: str = Field(default="organization", max_length=40)
    timezone: str = Field(default="UTC", max_length=80)
    attrs: dict[str, Any] = Field(default_factory=dict)


class CalendarPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    color: str | None = Field(default=None, max_length=32)
    visibility_scope: str | None = Field(default=None, max_length=40)
    timezone: str | None = Field(default=None, max_length=80)
    attrs: dict[str, Any] | None = None


class ParticipantRequest(BaseModel):
    participant_type: str = Field(..., max_length=40)
    participant_id: str | None = Field(default=None, max_length=80)
    email: str | None = Field(default=None, max_length=254)
    display_name: str | None = Field(default=None, max_length=160)
    role: str = Field(default="required", max_length=40)
    response_status: str = Field(default="needs_action", max_length=40)


class EventWriteRequest(BaseModel):
    calendar_id: str = Field(..., max_length=36)
    title: str = Field(..., min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=240)
    event_type: str = Field(default="event", max_length=40)
    status: str = Field(default="confirmed", max_length=40)
    starts_at: datetime
    ends_at: datetime
    timezone: str = Field(default="UTC", max_length=80)
    all_day: bool = False
    transparency: str = Field(default="busy", max_length=40)
    recurrence_rule: str | None = Field(default=None, max_length=500)
    recurrence_until: datetime | None = None
    source_module: str | None = Field(default=None, max_length=120)
    source_object_type: str | None = Field(default=None, max_length=80)
    source_object_id: str | None = Field(default=None, max_length=80)
    attrs: dict[str, Any] = Field(default_factory=dict)
    participants: list[ParticipantRequest] = Field(default_factory=list)


class EventPatchRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=240)
    description: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=240)
    status: str | None = Field(default=None, max_length=40)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    timezone: str | None = Field(default=None, max_length=80)
    all_day: bool | None = None
    transparency: str | None = Field(default=None, max_length=40)
    recurrence_rule: str | None = Field(default=None, max_length=500)
    recurrence_until: datetime | None = None
    attrs: dict[str, Any] | None = None


class ReminderWriteRequest(BaseModel):
    reminder_type: str = Field(default="in_app", max_length=40)
    trigger_minutes_before: int = Field(..., ge=0, le=43200)
