from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

_CODE_SEPARATOR_RE = re.compile(r"[\s_]+")
_MULTIPLE_HYPHENS_RE = re.compile(r"-+")
_NORMALIZED_CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")


def normalize_product_code(value: str) -> str:
    normalized = _CODE_SEPARATOR_RE.sub("-", value.strip().upper())
    normalized = _MULTIPLE_HYPHENS_RE.sub("-", normalized).strip("-")
    if not normalized or not _NORMALIZED_CODE_RE.fullmatch(normalized):
        raise ValueError("code must contain uppercase letters, numbers, and single hyphen separators")
    if len(normalized) > 80:
        raise ValueError("code must be 80 characters or fewer")
    return normalized


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def normalize_unit_code(value: str | None) -> str | None:
    normalized = normalize_optional_text(value)
    if normalized is None:
        return None
    normalized = normalize_product_code(normalized)
    if len(normalized) > 40:
        raise ValueError("base_unit_code must be 40 characters or fewer")
    return normalized


class ProductDefinitionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=80)
    canonical_name: str = Field(..., min_length=1, max_length=180)
    category: str | None = Field(default=None, max_length=120)
    grade: str | None = Field(default=None, max_length=120)
    specification: str | None = Field(default=None, max_length=2000)
    base_unit_code: str | None = Field(default=None, max_length=40)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return normalize_product_code(value)

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("canonical_name cannot be blank")
        return normalized

    @field_validator("category", "grade", "specification")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("base_unit_code")
    @classmethod
    def normalize_base_unit(cls, value: str | None) -> str | None:
        return normalize_unit_code(value)


class ProductDefinitionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    canonical_name: str | None = Field(default=None, max_length=180)
    category: str | None = Field(default=None, max_length=120)
    grade: str | None = Field(default=None, max_length=120)
    specification: str | None = Field(default=None, max_length=2000)
    base_unit_code: str | None = Field(default=None, max_length=40)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("product_definition_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return value.strip()

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("canonical_name cannot be blank")
        return normalized

    @field_validator("category", "grade", "specification", "reason")
    @classmethod
    def normalize_optional_fields(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)

    @field_validator("base_unit_code")
    @classmethod
    def normalize_base_unit(cls, value: str | None) -> str | None:
        return normalize_unit_code(value)


class ProductDefinitionVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)

    @field_validator("product_definition_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return value.strip()


class ProductDefinitionResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    code: str
    canonical_name: str
    category: str | None
    grade: str | None
    specification: str | None
    base_unit_code: str | None
    status: str
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class ProductNameHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    product_definition_id: str
    previous_name: str
    new_name: str
    reason: str
    changed_by_user_id: str
    changed_at: datetime


__all__ = [
    "ProductDefinitionCreateRequest",
    "ProductDefinitionResponse",
    "ProductDefinitionUpdateRequest",
    "ProductDefinitionVersionRequest",
    "ProductNameHistoryResponse",
    "normalize_product_code",
]
