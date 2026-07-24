from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .document_requirement_schemas import (
    ComplianceDocumentTypeReferenceResponse,
    ShipmentDocumentRequirementLevel,
    ShipmentDocumentRequirementStatus,
)

ShipmentDocumentInstanceStatus = Literal[
    "draft",
    "recorded",
    "verified",
    "rejected",
    "superseded",
]
ShipmentDocumentInstanceHistoryAction = Literal["created", "updated", "status_changed"]


def _clean_required(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _validate_dates(issued_on: date | None, expires_on: date | None) -> None:
    if issued_on is not None and expires_on is not None and expires_on < issued_on:
        raise ValueError("expires_on cannot be earlier than issued_on")


class ShipmentDocumentInstanceCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    compliance_document_type_id: str = Field(..., min_length=1, max_length=36)
    requirement_id: str | None = Field(default=None, max_length=36)
    document_number: str = Field(..., min_length=1, max_length=160)
    issuing_party_name: str | None = Field(default=None, max_length=240)
    issued_on: date | None = None
    expires_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "shipment_id",
        "compliance_document_type_id",
        "document_number",
    )
    @classmethod
    def normalize_required(cls, value: str, info) -> str:
        return _clean_required(value, info.field_name)

    @field_validator("requirement_id")
    @classmethod
    def normalize_requirement_id(cls, value: str | None) -> str | None:
        return None if value is None else _clean_required(value, "requirement_id")

    @field_validator("issuing_party_name", "notes")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)

    @model_validator(mode="after")
    def validate_date_order(self) -> ShipmentDocumentInstanceCreateRequest:
        _validate_dates(self.issued_on, self.expires_on)
        return self


class ShipmentDocumentInstanceUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    instance_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    document_number: str | None = Field(default=None, max_length=160)
    issuing_party_name: str | None = Field(default=None, max_length=240)
    issued_on: date | None = None
    expires_on: date | None = None
    notes: str | None = Field(default=None, max_length=2000)
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("shipment_id", "instance_id", "reason")
    @classmethod
    def normalize_required(cls, value: str, info) -> str:
        return _clean_required(value, info.field_name)

    @field_validator("document_number")
    @classmethod
    def normalize_document_number(cls, value: str | None) -> str | None:
        return None if value is None else _clean_required(value, "document_number")

    @field_validator("issuing_party_name", "notes")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _clean_optional(value)

    @model_validator(mode="after")
    def validate_supplied_date_order(self) -> ShipmentDocumentInstanceUpdateRequest:
        if {"issued_on", "expires_on"}.issubset(self.model_fields_set):
            _validate_dates(self.issued_on, self.expires_on)
        return self


class ShipmentDocumentInstanceStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    instance_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    new_status: ShipmentDocumentInstanceStatus
    reason: str = Field(..., min_length=1, max_length=500)
    mark_requirement_received: bool = False
    expected_requirement_version: int | None = Field(default=None, ge=1)

    @field_validator("shipment_id", "instance_id", "reason")
    @classmethod
    def normalize_required(cls, value: str, info) -> str:
        return _clean_required(value, info.field_name)

    @field_validator("new_status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_requirement_coupling(self) -> ShipmentDocumentInstanceStatusRequest:
        if self.mark_requirement_received:
            if self.new_status != "verified":
                raise ValueError(
                    "mark_requirement_received is valid only when verifying an instance"
                )
            if self.expected_requirement_version is None:
                raise ValueError(
                    "expected_requirement_version is required when marking a requirement received"
                )
        elif self.expected_requirement_version is not None:
            raise ValueError(
                "expected_requirement_version requires mark_requirement_received"
            )
        return self


class ShipmentDocumentInstanceRequirementResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    requirement_level: ShipmentDocumentRequirementLevel
    status: ShipmentDocumentRequirementStatus
    version: int


class ShipmentDocumentInstanceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    shipment_id: str
    compliance_document_type_id: str | None
    requirement_id: str | None
    document_number: str
    issuing_party_name: str | None
    issued_on: date | None
    expires_on: date | None
    status: ShipmentDocumentInstanceStatus
    notes: str | None
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    document_type: ComplianceDocumentTypeReferenceResponse
    requirement: ShipmentDocumentInstanceRequirementResponse | None


class ShipmentDocumentInstanceHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    shipment_id: str
    instance_id: str
    compliance_document_type_id: str | None
    requirement_id: str | None
    document_number: str
    issuing_party_name: str | None
    issued_on: date | None
    expires_on: date | None
    status: ShipmentDocumentInstanceStatus
    notes: str | None
    action: ShipmentDocumentInstanceHistoryAction
    version: int
    reason: str
    changed_by_user_id: str
    changed_at: datetime
    document_type: ComplianceDocumentTypeReferenceResponse


__all__ = [
    "ShipmentDocumentInstanceCreateRequest",
    "ShipmentDocumentInstanceHistoryAction",
    "ShipmentDocumentInstanceHistoryResponse",
    "ShipmentDocumentInstanceRequirementResponse",
    "ShipmentDocumentInstanceResponse",
    "ShipmentDocumentInstanceStatus",
    "ShipmentDocumentInstanceStatusRequest",
    "ShipmentDocumentInstanceUpdateRequest",
]
