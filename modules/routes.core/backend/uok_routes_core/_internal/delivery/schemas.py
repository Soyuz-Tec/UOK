from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

RouteMode = Literal["sea", "road", "rail", "air", "multimodal"]
StopRole = Literal["origin", "waypoint", "destination"]
ResolutionStatus = Literal["ready", "unavailable", "denied", "missing"]

_CODE_SEPARATOR_RE = re.compile(r"[\s_]+")
_MULTIPLE_HYPHENS_RE = re.compile(r"-+")
_NORMALIZED_CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")


def normalize_route_code(value: str) -> str:
    normalized = _CODE_SEPARATOR_RE.sub("-", value.strip().upper())
    normalized = _MULTIPLE_HYPHENS_RE.sub("-", normalized).strip("-")
    if not normalized or not _NORMALIZED_CODE_RE.fullmatch(normalized):
        raise ValueError("code must contain uppercase letters, numbers, and single hyphen separators")
    if len(normalized) > 80:
        raise ValueError("code must be 80 characters or fewer")
    return normalized


def _clean_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


def _validate_location_path(origin: str, waypoints: list[str], destination: str) -> None:
    ordered = [origin, *waypoints, destination]
    if len(ordered) < 2 or len(ordered) > 10:
        raise ValueError("route path must contain between 2 and 10 Locations")
    if len(set(ordered)) != len(ordered):
        raise ValueError("route path cannot repeat a Location")


class RouteDefinitionCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=80)
    canonical_name: str = Field(..., min_length=1, max_length=180)
    mode_hint: RouteMode | None = None
    origin_location_id: str = Field(..., min_length=1, max_length=36)
    destination_location_id: str = Field(..., min_length=1, max_length=36)
    waypoint_location_ids: list[str] = Field(default_factory=list, max_length=8)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return normalize_route_code(value)

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return _clean_required_text(value, "canonical_name")

    @field_validator("mode_hint", mode="before")
    @classmethod
    def normalize_mode(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("origin_location_id", "destination_location_id")
    @classmethod
    def normalize_location_id(cls, value: str) -> str:
        return _clean_required_text(value, "location identifier")

    @field_validator("waypoint_location_ids")
    @classmethod
    def normalize_waypoints(cls, values: list[str]) -> list[str]:
        return [_clean_required_text(value, "waypoint Location identifier") for value in values]

    @model_validator(mode="after")
    def validate_path(self) -> RouteDefinitionCreateRequest:
        _validate_location_path(self.origin_location_id, self.waypoint_location_ids, self.destination_location_id)
        return self


class RouteDefinitionUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    canonical_name: str | None = Field(default=None, max_length=180)
    mode_hint: RouteMode | None = None
    origin_location_id: str | None = Field(default=None, max_length=36)
    destination_location_id: str | None = Field(default=None, max_length=36)
    waypoint_location_ids: list[str] | None = Field(default=None, max_length=8)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("route_definition_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return _clean_required_text(value, "route_definition_id")

    @field_validator("canonical_name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_required_text(value, "canonical_name")

    @field_validator("mode_hint", mode="before")
    @classmethod
    def normalize_mode(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("origin_location_id", "destination_location_id")
    @classmethod
    def normalize_location_id(cls, value: str | None) -> str | None:
        return None if value is None else _clean_required_text(value, "location identifier")

    @field_validator("waypoint_location_ids")
    @classmethod
    def normalize_waypoints(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        return [_clean_required_text(value, "waypoint Location identifier") for value in values]

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def validate_path(self) -> RouteDefinitionUpdateRequest:
        path_fields = {"origin_location_id", "destination_location_id", "waypoint_location_ids"}
        supplied = path_fields.intersection(self.model_fields_set)
        if supplied and supplied != path_fields:
            raise ValueError("origin, destination, and waypoint Location fields must be supplied together")
        if supplied:
            if self.origin_location_id is None or self.destination_location_id is None or self.waypoint_location_ids is None:
                raise ValueError("route path fields cannot be null")
            _validate_location_path(
                self.origin_location_id,
                self.waypoint_location_ids,
                self.destination_location_id,
            )
        return self


class RouteDefinitionVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    route_definition_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)

    @field_validator("route_definition_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return _clean_required_text(value, "route_definition_id")


class LocationReferenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    location_definition_id: str
    status: ResolutionStatus
    code: str | None
    canonical_name: str | None
    location_type: str | None
    country_code: str | None
    status_summary: str


class RouteStopResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    sequence: int
    stop_role: StopRole
    location: LocationReferenceResponse


class RouteDefinitionResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    code: str
    canonical_name: str
    mode_hint: RouteMode | None
    status: str
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    stops: tuple[RouteStopResponse, ...]


class RouteNameHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    route_definition_id: str
    previous_name: str
    new_name: str
    reason: str
    changed_by_user_id: str
    changed_at: datetime


__all__ = [
    "LocationReferenceResponse",
    "RouteDefinitionCreateRequest",
    "RouteDefinitionResponse",
    "RouteDefinitionUpdateRequest",
    "RouteDefinitionVersionRequest",
    "RouteMode",
    "RouteNameHistoryResponse",
    "RouteStopResponse",
    "normalize_route_code",
]
