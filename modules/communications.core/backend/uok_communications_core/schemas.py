from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CommunicationThreadCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=2, max_length=180)
    context_type: str = Field(default="general", min_length=1, max_length=80, pattern=r"^[a-z][a-z0-9_.-]*$")
    context_id: str | None = Field(default=None, min_length=1, max_length=180)

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("title must contain at least two non-whitespace characters")
        return normalized

    @field_validator("context_id")
    @classmethod
    def normalize_context_id(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("context_id cannot be empty")
        return normalized


class CommunicationThreadResponse(BaseModel):
    id: str
    title: str
    status: str
    context_type: str
    context_id: str | None
    created_by_user_id: str
    created_at: str
    updated_at: str
