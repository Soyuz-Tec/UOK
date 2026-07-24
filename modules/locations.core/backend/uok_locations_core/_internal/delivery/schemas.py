from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

LocationType = Literal["port", "warehouse", "city", "region"]

_CODE_SEPARATOR_RE = re.compile(r"[\s_]+")
_MULTIPLE_HYPHENS_RE = re.compile(r"-+")
_NORMALIZED_CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")
_COUNTRY_CODE_RE = re.compile(r"^[A-Z]{2}$")


def normalize_location_code(value: str) -> str:
    normalized = _CODE_SEPARATOR_RE.sub("-", value.strip().upper())
    normalized = _MULTIPLE_HYPHENS_RE.sub("-", normalized).strip("-")
    if not normalized or not _NORMALIZED_CODE_RE.fullmatch(normalized):
        raise ValueError("code must contain uppercase letters, numbers, and single hyphen separators")
    if len(normalized) > 80:
        raise ValueError("code must be 80 characters or fewer")
    return normalized


def normalize_country_code(value: str) -> str:
    normalized = value.strip().upper()
    if not _COUNTRY_CODE_RE.fullmatch(normalized):
        raise ValueError("country_code must contain exactly two ASCII letters")
    return normalized


def normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


class LocationDefinitionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=80)
    canonical_name: str = Field(..., min_length=1, max_length=180)
    location_type: LocationType
    country_code: str = Field(..., min_length=2, max_length=2)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return normalize_location_code(value)

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("canonical_name cannot be blank")
        return normalized

    @field_validator("location_type", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("country_code", mode="before")
    @classmethod
    def normalize_country(cls, value: object) -> object:
        return normalize_country_code(value) if isinstance(value, str) else value


class LocationDefinitionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    canonical_name: str | None = Field(default=None, max_length=180)
    location_type: LocationType | None = None
    country_code: str | None = Field(default=None, min_length=2, max_length=2)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("location_definition_id")
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

    @field_validator("location_type", mode="before")
    @classmethod
    def normalize_type(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("country_code", mode="before")
    @classmethod
    def normalize_country(cls, value: object) -> object:
        return normalize_country_code(value) if isinstance(value, str) else value

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        return normalize_optional_text(value)


class LocationDefinitionVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    location_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)

    @field_validator("location_definition_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return value.strip()


class LocationDefinitionResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    code: str
    canonical_name: str
    location_type: LocationType
    country_code: str
    status: str
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None


class LocationNameHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    location_definition_id: str
    previous_name: str
    new_name: str
    reason: str
    changed_by_user_id: str
    changed_at: datetime


__all__ = [
    "LocationDefinitionCreateRequest",
    "LocationDefinitionResponse",
    "LocationDefinitionUpdateRequest",
    "LocationDefinitionVersionRequest",
    "LocationNameHistoryResponse",
    "LocationType",
    "normalize_country_code",
    "normalize_location_code",
]
