from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ComplianceDocumentTypeStatus = Literal["active", "inactive", "archived"]

_CODE_SEPARATOR_RE = re.compile(r"[\s_]+")
_MULTIPLE_HYPHENS_RE = re.compile(r"-+")
_NORMALIZED_CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")


def normalize_compliance_document_type_code(value: str) -> str:
    normalized = _CODE_SEPARATOR_RE.sub("-", value.strip().upper())
    normalized = _MULTIPLE_HYPHENS_RE.sub("-", normalized).strip("-")
    if not normalized or not _NORMALIZED_CODE_RE.fullmatch(normalized):
        raise ValueError(
            "code must contain uppercase letters, numbers, and single hyphen separators"
        )
    if len(normalized) > 80:
        raise ValueError("code must be 80 characters or fewer")
    return normalized


def _required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


def _optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class ComplianceDocumentTypeCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=80)
    canonical_name: str = Field(..., min_length=1, max_length=180)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=120)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return normalize_compliance_document_type_code(value)

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _required_text(value, "canonical_name")

    @field_validator("description", "category")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _optional_text(value)


class ComplianceDocumentTypeUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    compliance_document_type_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    canonical_name: str | None = Field(default=None, max_length=180)
    description: str | None = Field(default=None, max_length=2000)
    category: str | None = Field(default=None, max_length=120)
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("compliance_document_type_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return _required_text(value, "compliance_document_type_id")

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _required_text(value, "canonical_name")

    @field_validator("description", "category")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return _optional_text(value)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _required_text(value, "reason")


class ComplianceDocumentTypeLifecycleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    compliance_document_type_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("compliance_document_type_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return _required_text(value, "compliance_document_type_id")

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _required_text(value, "reason")


class ComplianceDocumentTypeResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    code: str
    canonical_name: str
    description: str | None
    category: str | None
    status: ComplianceDocumentTypeStatus
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class ComplianceDocumentTypeNameHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    compliance_document_type_id: str
    previous_name: str
    new_name: str
    reason: str
    changed_by_user_id: str
    changed_at: datetime


__all__ = [
    "ComplianceDocumentTypeCreateRequest",
    "ComplianceDocumentTypeLifecycleRequest",
    "ComplianceDocumentTypeNameHistoryResponse",
    "ComplianceDocumentTypeResponse",
    "ComplianceDocumentTypeStatus",
    "ComplianceDocumentTypeUpdateRequest",
    "normalize_compliance_document_type_code",
]
