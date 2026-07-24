from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_intelligence_core._internal.delivery.readiness import (
    derive_shipment_readiness,
)
from uok_intelligence_core._internal.delivery.shipment_gateway import (
    ShipmentReadinessFacts,
)
from uok_intelligence_core.public_api import __all__ as public_symbols
from uok_intelligence_core.public_api import role_grants


def test_attention_signal_has_deterministic_multiple_reasons() -> None:
    signal = derive_shipment_readiness(_facts(
        required_total=2,
        required_satisfied=1,
        required_missing=1,
        required_received=1,
        document_instance_total=4,
        document_instance_draft=1,
        document_instance_verified=1,
        document_instance_rejected=1,
        document_instance_superseded=1,
    ))

    assert signal.band == "attention_required"
    assert signal.reason_codes == (
        "required_documents_missing",
        "rejected_document_present",
        "document_metadata_pending_review",
        "verified_document_present",
    )
    assert signal.status_summary == (
        "Shipment needs attention: 1 required document(s) missing and "
        "1 rejected document record(s)."
    )


def test_not_assessed_and_ready_rules_are_exact() -> None:
    not_assessed = derive_shipment_readiness(_facts(
        document_instance_total=1,
        document_instance_recorded=1,
    ))
    ready = derive_shipment_readiness(_facts(
        required_total=2,
        required_satisfied=2,
        required_received=1,
        required_waived=1,
        document_instance_total=1,
        document_instance_verified=1,
    ))

    assert not_assessed.band == "not_assessed"
    assert not_assessed.reason_codes == (
        "requirements_not_defined",
        "document_metadata_pending_review",
    )
    assert ready.band == "ready"
    assert ready.reason_codes == (
        "required_documents_satisfied",
        "verified_document_present",
    )
    with pytest.raises(ValidationError, match="frozen"):
        ready.band = "attention_required"  # type: ignore[misc]


def test_public_facade_manifest_and_stateless_boundary_are_exact() -> None:
    assert public_symbols == ["api_router", "role_grants"]
    assert role_grants() == {
        "ops_manager": {"intelligence.read"},
        "trader": {"intelligence.read"},
        "finance_manager": {"intelligence.read"},
        "viewer": {"intelligence.read"},
    }
    manifest = load_module_manifests()["intelligence.core"]
    assert manifest["dependencies"] == ["shipments.core"]
    assert manifest["commands"] == []
    assert manifest["events"] == []
    assert manifest["permissions"] == ["intelligence.read"]
    assert manifest["owned_tables"] == []
    assert manifest.get("model_exports") is None
    root = Path(__file__).parents[1]
    assert list((root / "migrations").glob("*.sql")) == []


def _facts(**overrides: int) -> ShipmentReadinessFacts:
    values: dict[str, object] = {
        "shipment_id": "shipment-1",
        "code": "READY-SHIPMENT-1",
        "lifecycle_status": "draft",
        "open_path": "/?view=shipments&shipment_id=shipment-1",
        "required_total": 0,
        "required_satisfied": 0,
        "required_missing": 0,
        "required_received": 0,
        "required_waived": 0,
        "required_not_applicable": 0,
        "optional_total": 0,
        "document_instance_total": 0,
        "document_instance_draft": 0,
        "document_instance_recorded": 0,
        "document_instance_verified": 0,
        "document_instance_rejected": 0,
        "document_instance_superseded": 0,
    }
    values.update(overrides)
    return ShipmentReadinessFacts(**values)  # type: ignore[arg-type]
