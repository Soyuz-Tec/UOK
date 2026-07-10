from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from ..commands import MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH, MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH
from ..contact_api_schemas import (  # noqa: F401
    ContactCsvImportRequest,
    ContactGroupMembersRequest,
    ContactGroupUpdateRequest,
    ContactGroupWriteRequest,
    ContactNoteRequest,
    ContactRelationshipRequest,
    ContactRelationshipUpdateRequest,
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
    idempotency_key: str = Field(
        ...,
        min_length=MIN_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        max_length=MAX_CLIENT_IDEMPOTENCY_KEY_LENGTH,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
        description="Required and reused unchanged for retries of one user intent.",
    )


class IdempotencyConflictDetail(BaseModel):
    error: str


class IdempotencyConflictResponse(BaseModel):
    detail: IdempotencyConflictDetail


class CommandPreconditionDetail(BaseModel):
    code: str
    message: str
    repair: str
    current_revision: int = Field(..., ge=1)
    current_etag: str
    object_ids: list[str]
    reload_url: str


class CommandPreconditionResponse(BaseModel):
    error: CommandPreconditionDetail
