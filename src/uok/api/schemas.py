from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from ..commands import MAX_IDEMPOTENCY_KEY_LENGTH
from ..contact_api_schemas import (  # noqa: F401
    ContactCsvImportRequest,
    ContactNoteRequest,
    ContactProfileEvidenceRequest,
    ContactProfileRebuildRequest,
    ContactProfileWriteRequest,
    ContactRelationshipRequest,
    ContactWriteRequest,
)


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)


class RegisterRequest(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=160)
    email: str = Field(..., max_length=254)
    password: str = Field(..., min_length=8, max_length=128)


class CommandRequest(BaseModel):
    command_type: str = Field(..., max_length=120, examples=["CreateContact"])
    payload: dict[str, Any] = Field(default_factory=dict)
    idempotency_key: str | None = Field(default=None, max_length=MAX_IDEMPOTENCY_KEY_LENGTH)
