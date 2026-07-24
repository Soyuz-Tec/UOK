from __future__ import annotations

from .schemas import (
    ReadinessBand,
    ReadinessReasonCode,
    ShipmentReadinessSignalResponse,
)
from .shipment_gateway import ShipmentReadinessFacts


def derive_shipment_readiness(
    facts: ShipmentReadinessFacts,
) -> ShipmentReadinessSignalResponse:
    """Derive a deterministic advisory signal without mutating owner state."""
    band = _readiness_band(facts)
    return ShipmentReadinessSignalResponse(
        shipment_id=facts.shipment_id,
        code=facts.code,
        lifecycle_status=facts.lifecycle_status,
        open_path=facts.open_path,
        band=band,
        reason_codes=_reason_codes(facts),
        status_summary=_status_summary(facts, band),
        required_total=facts.required_total,
        required_satisfied=facts.required_satisfied,
        required_missing=facts.required_missing,
        required_received=facts.required_received,
        required_waived=facts.required_waived,
        required_not_applicable=facts.required_not_applicable,
        optional_total=facts.optional_total,
        document_instance_total=facts.document_instance_total,
        document_instance_draft=facts.document_instance_draft,
        document_instance_recorded=facts.document_instance_recorded,
        document_instance_verified=facts.document_instance_verified,
        document_instance_rejected=facts.document_instance_rejected,
        document_instance_superseded=facts.document_instance_superseded,
    )


def _readiness_band(facts: ShipmentReadinessFacts) -> ReadinessBand:
    if facts.required_missing > 0 or facts.document_instance_rejected > 0:
        return "attention_required"
    if facts.required_total == 0:
        return "not_assessed"
    return "ready"


def _reason_codes(
    facts: ShipmentReadinessFacts,
) -> tuple[ReadinessReasonCode, ...]:
    reasons: list[ReadinessReasonCode] = []
    if facts.required_missing > 0:
        reasons.append("required_documents_missing")
    if facts.document_instance_rejected > 0:
        reasons.append("rejected_document_present")
    if facts.required_total == 0:
        reasons.append("requirements_not_defined")
    elif facts.required_missing == 0:
        reasons.append("required_documents_satisfied")
    if facts.document_instance_draft + facts.document_instance_recorded > 0:
        reasons.append("document_metadata_pending_review")
    if facts.document_instance_verified > 0:
        reasons.append("verified_document_present")
    return tuple(reasons)


def _status_summary(
    facts: ShipmentReadinessFacts,
    band: ReadinessBand,
) -> str:
    if band == "attention_required":
        return (
            "Shipment needs attention: "
            f"{facts.required_missing} required document(s) missing and "
            f"{facts.document_instance_rejected} rejected document record(s)."
        )
    if band == "not_assessed":
        return (
            "Shipment readiness is not assessed because no required "
            "document types are defined."
        )
    return "Shipment required document metadata is satisfied."


__all__ = ["derive_shipment_readiness"]
