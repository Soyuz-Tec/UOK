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
        document_instance_expiry_evaluated=(
            facts.document_instance_expiry_evaluated
        ),
        document_instance_expiry_not_recorded=(
            facts.document_instance_expiry_not_recorded
        ),
        document_instance_expired=facts.document_instance_expired,
        document_instance_expiring_soon=(
            facts.document_instance_expiring_soon
        ),
        next_document_expiry_on=facts.next_document_expiry_on,
    )


def _readiness_band(facts: ShipmentReadinessFacts) -> ReadinessBand:
    if (
        facts.required_missing > 0
        or facts.document_instance_rejected > 0
        or facts.document_instance_expired > 0
        or facts.document_instance_expiring_soon > 0
    ):
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
    if facts.document_instance_expired > 0:
        reasons.append("expired_document_present")
    if facts.document_instance_expiring_soon > 0:
        reasons.append("expiring_document_present")
    if facts.required_total == 0:
        reasons.append("requirements_not_defined")
    elif facts.required_missing == 0:
        reasons.append("required_documents_satisfied")
    if facts.document_instance_draft + facts.document_instance_recorded > 0:
        reasons.append("document_metadata_pending_review")
    if facts.document_instance_verified > 0:
        reasons.append("verified_document_present")
    if facts.document_instance_expiry_not_recorded > 0:
        reasons.append("document_expiry_not_recorded")
    return tuple(reasons)


def _status_summary(
    facts: ShipmentReadinessFacts,
    band: ReadinessBand,
) -> str:
    if band == "attention_required":
        conditions: list[str] = []
        if facts.required_missing > 0:
            conditions.append(
                f"{facts.required_missing} required document(s) missing"
            )
        if facts.document_instance_rejected > 0:
            conditions.append(
                f"{facts.document_instance_rejected} rejected document record(s)"
            )
        if facts.document_instance_expired > 0:
            conditions.append(
                f"{facts.document_instance_expired} expired document record(s)"
            )
        if facts.document_instance_expiring_soon > 0:
            conditions.append(
                f"{facts.document_instance_expiring_soon} document record(s) "
                "expiring soon"
            )
        return f"Shipment needs attention: {_join_conditions(conditions)}."
    if band == "not_assessed":
        return (
            "Shipment readiness is not assessed because no required "
            "document types are defined."
        )
    return "Shipment required document metadata is satisfied."


def _join_conditions(conditions: list[str]) -> str:
    if len(conditions) == 1:
        return conditions[0]
    return f"{', '.join(conditions[:-1])} and {conditions[-1]}"


__all__ = ["derive_shipment_readiness"]
