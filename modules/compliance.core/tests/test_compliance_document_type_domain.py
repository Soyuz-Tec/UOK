from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_compliance_core._internal.delivery.schemas import (
    ComplianceDocumentTypeCreateRequest,
    ComplianceDocumentTypeLifecycleRequest,
    ComplianceDocumentTypeResponse,
    ComplianceDocumentTypeUpdateRequest,
)
from uok_compliance_core._internal.persistence.models import (
    ComplianceDocumentType,
    ComplianceDocumentTypeNameHistory,
    owned_models,
)
from uok_compliance_core.public_api import __all__ as public_symbols


def test_compliance_document_type_input_normalizes_code_and_optional_text() -> None:
    request = ComplianceDocumentTypeCreateRequest(
        code="  bill__of_lading  ",
        canonical_name="  Bill of Lading  ",
        description="  Transport evidence  ",
        category="  Transport  ",
    )

    assert request.model_dump() == {
        "code": "BILL-OF-LADING",
        "canonical_name": "Bill of Lading",
        "description": "Transport evidence",
        "category": "Transport",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "***", "canonical_name": "Bill of Lading"},
        {"code": "BOL", "canonical_name": "   "},
        {"code": "BOL", "canonical_name": "Bill", "unexpected": True},
    ],
)
def test_create_contract_rejects_invalid_or_extra_fields(
    payload: dict[str, object],
) -> None:
    with pytest.raises(ValidationError):
        ComplianceDocumentTypeCreateRequest.model_validate(payload)


def test_update_and_lifecycle_require_version_reason_and_immutable_code() -> None:
    with pytest.raises(ValidationError):
        ComplianceDocumentTypeUpdateRequest.model_validate(
            {
                "compliance_document_type_id": "type-1",
                "expected_version": 0,
                "canonical_name": "Updated",
                "reason": "Review",
            }
        )
    with pytest.raises(ValidationError):
        ComplianceDocumentTypeUpdateRequest.model_validate(
            {
                "compliance_document_type_id": "type-1",
                "expected_version": 1,
                "code": "NEW-CODE",
                "reason": "Review",
            }
        )
    with pytest.raises(ValidationError):
        ComplianceDocumentTypeLifecycleRequest.model_validate(
            {
                "compliance_document_type_id": "type-1",
                "expected_version": 1,
                "reason": "   ",
            }
        )


def test_response_is_frozen_and_excludes_tenant_identity() -> None:
    now = datetime.now(timezone.utc)
    response = ComplianceDocumentTypeResponse(
        id="type-1",
        code="BILL-OF-LADING",
        canonical_name="Bill of Lading",
        description=None,
        category="Transport",
        status="active",
        version=1,
        created_by_user_id="user-1",
        updated_by_user_id="user-1",
        created_at=now,
        updated_at=now,
        archived_at=None,
    )

    assert "organization_id" not in response.model_dump()
    with pytest.raises(ValidationError, match="frozen"):
        response.canonical_name = "Changed"  # type: ignore[misc]


def test_owner_models_and_exact_six_symbol_public_contract() -> None:
    assert owned_models() == {
        "ComplianceDocumentType": ComplianceDocumentType,
        "ComplianceDocumentTypeNameHistory": (
            ComplianceDocumentTypeNameHistory
        ),
    }
    assert public_symbols == [
        "ComplianceDocumentTypeReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_compliance_document_type_references",
        "role_grants",
    ]
    assert ComplianceDocumentType.__tablename__ == "compliance_document_types"
    assert (
        ComplianceDocumentTypeNameHistory.__tablename__
        == "compliance_document_type_name_history"
    )


def test_manifest_and_migration_declare_exact_owner_contract() -> None:
    root = Path(__file__).parents[1]
    manifest_text = (root / "manifest.yaml").read_text(encoding="utf-8")
    migration = (root / "migrations" / "001_compliance_core.sql").read_text(
        encoding="utf-8"
    )
    for value in (
        "uok_compliance_core.public_api:api_router",
        "uok_compliance_core._internal.persistence.models:owned_models",
        "ComplianceDocumentType",
        "ComplianceDocumentTypeNameHistory",
        "compliance.read",
        "compliance.manage",
    ):
        assert value in manifest_text
    assert "CREATE TABLE IF NOT EXISTS compliance_document_types" in migration
    assert (
        "CREATE TABLE IF NOT EXISTS compliance_document_type_name_history"
        in migration
    )
    assert "UNIQUE (organization_id, code)" in migration
    assert "status IN ('active', 'inactive', 'archived')" in migration


def test_manifest_declares_exact_executable_boundary() -> None:
    manifest = load_module_manifests()["compliance.core"]

    assert manifest["required"] is False
    assert manifest["kind"] == "capability_module"
    assert manifest["maturity"] == "runtime_proven"
    assert manifest["dependencies"] == []
    assert manifest["backend_path"] == "modules/compliance.core/backend"
    assert manifest["api_prefixes"] == ["/api/compliance"]
    assert manifest["api_router"] == "uok_compliance_core.public_api:api_router"
    assert (
        manifest["model_exports"]
        == "uok_compliance_core._internal.persistence.models:owned_models"
    )
    assert set(manifest["commands"]) == {
        "CreateComplianceDocumentType",
        "UpdateComplianceDocumentType",
        "DeactivateComplianceDocumentType",
        "ActivateComplianceDocumentType",
        "ArchiveComplianceDocumentType",
        "RestoreComplianceDocumentType",
    }
    assert set(manifest["events"]) == {
        "ComplianceDocumentTypeCreated",
        "ComplianceDocumentTypeUpdated",
        "ComplianceDocumentTypeDeactivated",
        "ComplianceDocumentTypeActivated",
        "ComplianceDocumentTypeArchived",
        "ComplianceDocumentTypeRestored",
    }
    assert set(manifest["permissions"]) == {
        "compliance.read",
        "compliance.manage",
    }
