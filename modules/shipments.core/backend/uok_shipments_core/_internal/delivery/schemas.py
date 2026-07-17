from __future__ import annotations

import re
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ShipmentStatus = Literal["draft", "planned", "in_transit", "arrived", "closed", "cancelled"]
ResolutionStatus = Literal["ready", "unavailable", "denied", "missing"]

_CODE_SEPARATOR_RE = re.compile(r"[\s_]+")
_MULTIPLE_HYPHENS_RE = re.compile(r"-+")
_NORMALIZED_CODE_RE = re.compile(r"^[A-Z0-9]+(?:-[A-Z0-9]+)*$")


def normalize_shipment_code(value: str) -> str:
    normalized = _CODE_SEPARATOR_RE.sub("-", value.strip().upper())
    normalized = _MULTIPLE_HYPHENS_RE.sub("-", normalized).strip("-")
    if not normalized or not _NORMALIZED_CODE_RE.fullmatch(normalized):
        raise ValueError("code must contain uppercase letters, numbers, and single hyphen separators")
    if len(normalized) > 80:
        raise ValueError("code must be 80 characters or fewer")
    return normalized


def _clean_identifier(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


def _validate_dates(departure: date | None, arrival: date | None) -> None:
    if departure is not None and arrival is not None and arrival < departure:
        raise ValueError("planned_arrival_on cannot be earlier than planned_departure_on")


class ShipmentCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=80)
    shipper_party_id: str = Field(..., min_length=1, max_length=36)
    consignee_party_id: str = Field(..., min_length=1, max_length=36)
    origin_location_id: str = Field(..., min_length=1, max_length=36)
    destination_location_id: str = Field(..., min_length=1, max_length=36)
    route_definition_id: str | None = Field(default=None, max_length=36)
    planned_departure_on: date | None = None
    planned_arrival_on: date | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return normalize_shipment_code(value)

    @field_validator(
        "shipper_party_id",
        "consignee_party_id",
        "origin_location_id",
        "destination_location_id",
    )
    @classmethod
    def normalize_identifier(cls, value: str, info) -> str:
        return _clean_identifier(value, info.field_name)

    @field_validator("route_definition_id")
    @classmethod
    def normalize_route_identifier(cls, value: str | None) -> str | None:
        return None if value is None else _clean_identifier(value, "route_definition_id")

    @model_validator(mode="after")
    def validate_endpoints_and_dates(self) -> ShipmentCreateRequest:
        if self.origin_location_id == self.destination_location_id:
            raise ValueError("origin and destination Locations must be different")
        _validate_dates(self.planned_departure_on, self.planned_arrival_on)
        return self


class ShipmentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    shipper_party_id: str | None = Field(default=None, max_length=36)
    consignee_party_id: str | None = Field(default=None, max_length=36)
    origin_location_id: str | None = Field(default=None, max_length=36)
    destination_location_id: str | None = Field(default=None, max_length=36)
    route_definition_id: str | None = Field(default=None, max_length=36)
    planned_departure_on: date | None = None
    planned_arrival_on: date | None = None

    @field_validator("shipment_id")
    @classmethod
    def normalize_shipment_identifier(cls, value: str) -> str:
        return _clean_identifier(value, "shipment_id")

    @field_validator(
        "shipper_party_id",
        "consignee_party_id",
        "origin_location_id",
        "destination_location_id",
    )
    @classmethod
    def normalize_optional_identifier(cls, value: str | None, info) -> str | None:
        return None if value is None else _clean_identifier(value, info.field_name)

    @field_validator("route_definition_id")
    @classmethod
    def normalize_route_identifier(cls, value: str | None) -> str | None:
        return None if value is None else _clean_identifier(value, "route_definition_id")


class ShipmentTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    new_status: ShipmentStatus
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("shipment_id")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        return _clean_identifier(value, "shipment_id")

    @field_validator("new_status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _clean_identifier(value, "reason")


class PartyReferenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    status: ResolutionStatus
    display_label: str | None
    status_summary: str
    open_path: str | None = None


class LocationReferenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    location_definition_id: str
    status: ResolutionStatus
    code: str | None
    canonical_name: str | None
    location_type: str | None
    country_code: str | None
    status_summary: str


class RoutePathReferenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    route_definition_id: str
    status: ResolutionStatus
    code: str | None
    canonical_name: str | None
    mode_hint: str | None
    ordered_location_ids: tuple[str, ...]
    status_summary: str


class ShipmentResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    code: str
    shipper_party_id: str
    consignee_party_id: str
    origin_location_id: str
    destination_location_id: str
    route_definition_id: str | None
    planned_departure_on: date | None
    planned_arrival_on: date | None
    status: ShipmentStatus
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    shipper: PartyReferenceResponse
    consignee: PartyReferenceResponse
    origin: LocationReferenceResponse
    destination: LocationReferenceResponse
    route: RoutePathReferenceResponse | None


class ShipmentStatusHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    shipment_id: str
    previous_status: ShipmentStatus
    new_status: ShipmentStatus
    reason: str
    changed_by_user_id: str
    version: int
    changed_at: datetime


__all__ = [
    "LocationReferenceResponse",
    "PartyReferenceResponse",
    "RoutePathReferenceResponse",
    "ShipmentCreateRequest",
    "ShipmentResponse",
    "ShipmentStatus",
    "ShipmentStatusHistoryResponse",
    "ShipmentTransitionRequest",
    "ShipmentUpdateRequest",
    "normalize_shipment_code",
]
