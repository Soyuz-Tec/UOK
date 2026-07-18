from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ShipmentDocumentRequirementLevel = Literal["required", "optional"]
ShipmentDocumentRequirementStatus = Literal["missing", "received", "waived", "not_applicable"]
ShipmentDocumentRequirementHistoryAction = Literal["added", "updated", "status_changed", "removed"]
ResolutionStatus = Literal["ready", "unavailable", "denied", "missing"]


def _clean_identifier(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} cannot be blank")
    return normalized


class ShipmentDocumentRequirementAddRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    compliance_document_type_id: str = Field(..., min_length=1, max_length=36)
    requirement_level: ShipmentDocumentRequirementLevel
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("shipment_id", "compliance_document_type_id")
    @classmethod
    def normalize_identifier(cls, value: str, info) -> str:
        return _clean_identifier(value, info.field_name)

    @field_validator("requirement_level", mode="before")
    @classmethod
    def normalize_level(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ShipmentDocumentRequirementUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    requirement_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    requirement_level: ShipmentDocumentRequirementLevel | None = None
    notes: str | None = Field(default=None, max_length=2000)
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("shipment_id", "requirement_id")
    @classmethod
    def normalize_identifier(cls, value: str, info) -> str:
        return _clean_identifier(value, info.field_name)

    @field_validator("requirement_level", mode="before")
    @classmethod
    def normalize_level(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _clean_identifier(value, "reason")


class ShipmentDocumentRequirementStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    requirement_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    new_status: ShipmentDocumentRequirementStatus
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("shipment_id", "requirement_id")
    @classmethod
    def normalize_identifier(cls, value: str, info) -> str:
        return _clean_identifier(value, info.field_name)

    @field_validator("new_status", mode="before")
    @classmethod
    def normalize_status(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _clean_identifier(value, "reason")


class ShipmentDocumentRequirementRemoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    shipment_id: str = Field(..., min_length=1, max_length=36)
    requirement_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    reason: str = Field(..., min_length=1, max_length=500)

    @field_validator("shipment_id", "requirement_id")
    @classmethod
    def normalize_identifier(cls, value: str, info) -> str:
        return _clean_identifier(value, info.field_name)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str) -> str:
        return _clean_identifier(value, "reason")


class ComplianceDocumentTypeReferenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    compliance_document_type_id: str | None
    status: ResolutionStatus
    code: str | None
    canonical_name: str | None
    category: str | None
    lifecycle_status: str | None
    status_summary: str


class ShipmentDocumentRequirementResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    shipment_id: str
    compliance_document_type_id: str | None
    requirement_level: ShipmentDocumentRequirementLevel
    status: ShipmentDocumentRequirementStatus
    notes: str | None
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    document_type: ComplianceDocumentTypeReferenceResponse


class ShipmentDocumentRequirementSummaryResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    required_total: int
    required_satisfied: int
    required_missing: int
    required_received: int
    required_waived: int
    required_not_applicable: int
    optional_total: int


class ShipmentDocumentRequirementListResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    items: tuple[ShipmentDocumentRequirementResponse, ...]
    summary: ShipmentDocumentRequirementSummaryResponse


class ShipmentDocumentRequirementHistoryResponse(BaseModel):
    model_config = ConfigDict(frozen=True, from_attributes=True)

    id: str
    shipment_id: str
    requirement_id: str
    compliance_document_type_id: str | None
    action: ShipmentDocumentRequirementHistoryAction
    requirement_level: ShipmentDocumentRequirementLevel
    status: ShipmentDocumentRequirementStatus
    notes: str | None
    version: int
    reason: str
    changed_by_user_id: str
    changed_at: datetime
    document_type: ComplianceDocumentTypeReferenceResponse


__all__ = [
    "ComplianceDocumentTypeReferenceResponse",
    "ShipmentDocumentRequirementAddRequest",
    "ShipmentDocumentRequirementHistoryAction",
    "ShipmentDocumentRequirementHistoryResponse",
    "ShipmentDocumentRequirementLevel",
    "ShipmentDocumentRequirementListResponse",
    "ShipmentDocumentRequirementRemoveRequest",
    "ShipmentDocumentRequirementResponse",
    "ShipmentDocumentRequirementStatus",
    "ShipmentDocumentRequirementStatusRequest",
    "ShipmentDocumentRequirementSummaryResponse",
    "ShipmentDocumentRequirementUpdateRequest",
]
