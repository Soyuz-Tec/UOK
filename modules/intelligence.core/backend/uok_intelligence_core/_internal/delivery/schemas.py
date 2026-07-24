from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ReadinessBand = Literal["attention_required", "not_assessed", "ready"]
ReadinessReasonCode = Literal[
    "required_documents_missing",
    "rejected_document_present",
    "requirements_not_defined",
    "required_documents_satisfied",
    "document_metadata_pending_review",
    "verified_document_present",
]


class ShipmentReadinessSignalResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    shipment_id: str
    code: str
    lifecycle_status: str
    open_path: str | None
    band: ReadinessBand
    reason_codes: tuple[ReadinessReasonCode, ...]
    status_summary: str
    required_total: int = Field(ge=0)
    required_satisfied: int = Field(ge=0)
    required_missing: int = Field(ge=0)
    required_received: int = Field(ge=0)
    required_waived: int = Field(ge=0)
    required_not_applicable: int = Field(ge=0)
    optional_total: int = Field(ge=0)
    document_instance_total: int = Field(ge=0)
    document_instance_draft: int = Field(ge=0)
    document_instance_recorded: int = Field(ge=0)
    document_instance_verified: int = Field(ge=0)
    document_instance_rejected: int = Field(ge=0)
    document_instance_superseded: int = Field(ge=0)


class ShipmentReadinessListResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    source_status: Literal["ready"]
    source_summary: str
    items: tuple[ShipmentReadinessSignalResponse, ...]


__all__ = [
    "ReadinessBand",
    "ReadinessReasonCode",
    "ShipmentReadinessListResponse",
    "ShipmentReadinessSignalResponse",
]
