from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_locations_core._internal.delivery.schemas import (
    LocationDefinitionCreateRequest,
    LocationDefinitionResponse,
    LocationDefinitionUpdateRequest,
)
from uok_locations_core._internal.persistence.models import LocationDefinition, LocationNameHistory, owned_models
from uok_locations_core.public_api import __all__ as public_symbols


def test_location_definition_input_normalizes_codes_type_country_and_name() -> None:
    request = LocationDefinitionCreateRequest(
        code="  ng__apapa_port  ",
        canonical_name="  Apapa Port  ",
        location_type=" PORT ",
        country_code=" ng ",
    )

    assert request.model_dump() == {
        "code": "NG-APAPA-PORT",
        "canonical_name": "Apapa Port",
        "location_type": "port",
        "country_code": "NG",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "***", "canonical_name": "Port", "location_type": "port", "country_code": "NG"},
        {"code": "PORT", "canonical_name": "   ", "location_type": "port", "country_code": "NG"},
        {"code": "PORT", "canonical_name": "Port", "location_type": "terminal", "country_code": "NG"},
        {"code": "PORT", "canonical_name": "Port", "location_type": "port", "country_code": "N1"},
        {
            "code": "PORT",
            "canonical_name": "Port",
            "location_type": "port",
            "country_code": "NG",
            "unexpected": True,
        },
    ],
)
def test_location_definition_input_rejects_invalid_or_extra_fields(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        LocationDefinitionCreateRequest.model_validate(payload)


def test_update_contract_requires_positive_version_and_forbids_code_changes() -> None:
    with pytest.raises(ValidationError):
        LocationDefinitionUpdateRequest.model_validate({
            "location_definition_id": "location-1",
            "expected_version": 0,
            "canonical_name": "Updated",
        })
    with pytest.raises(ValidationError):
        LocationDefinitionUpdateRequest.model_validate({
            "location_definition_id": "location-1",
            "expected_version": 1,
            "code": "NEW-CODE",
        })


def test_location_response_dto_is_frozen_and_excludes_tenant_identity() -> None:
    now = datetime.now(timezone.utc)
    response = LocationDefinitionResponse(
        id="location-1",
        code="NG-APAPA-PORT",
        canonical_name="Apapa Port",
        location_type="port",
        country_code="NG",
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


def test_location_master_owns_two_private_models_and_narrow_public_contract() -> None:
    assert owned_models() == {
        "LocationDefinition": LocationDefinition,
        "LocationNameHistory": LocationNameHistory,
    }
    assert public_symbols == [
        "LocationReferenceResolution",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_location_references",
        "role_grants",
    ]
    assert LocationDefinition.__tablename__ == "location_definitions"
    assert LocationNameHistory.__tablename__ == "location_name_history"


def test_location_master_manifest_and_migration_declare_owner_contract() -> None:
    root = Path(__file__).parents[1]
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    migration = (root / "migrations" / "001_locations_core.sql").read_text(encoding="utf-8")
    for value in (
        "uok_locations_core.public_api:api_router",
        "uok_locations_core._internal.persistence.models:owned_models",
        "LocationDefinition",
        "LocationNameHistory",
        "locations.read",
        "locations.manage",
    ):
        assert value in manifest
    assert "CREATE TABLE IF NOT EXISTS location_definitions" in migration
    assert "CREATE TABLE IF NOT EXISTS location_name_history" in migration
    assert "UNIQUE (organization_id, code)" in migration
    assert "location_type IN ('port', 'warehouse', 'city', 'region')" in migration


def test_location_master_manifest_declares_exact_executable_boundary() -> None:
    manifest = load_module_manifests()["locations.core"]

    assert manifest["required"] is False
    assert manifest["kind"] == "capability_module"
    assert manifest["maturity"] == "runtime_proven"
    assert manifest["dependencies"] == []
    assert manifest["backend_path"] == "modules/locations.core/backend"
    assert manifest["api_prefixes"] == ["/api/locations"]
    assert manifest["api_router"] == "uok_locations_core.public_api:api_router"
    assert manifest["command_handlers"] == "uok_locations_core.public_api:command_handlers"
    assert manifest["command_permissions"] == "uok_locations_core.public_api:command_permissions"
    assert manifest["role_grants"] == "uok_locations_core.public_api:role_grants"
    assert manifest["model_exports"] == "uok_locations_core._internal.persistence.models:owned_models"
    assert manifest["candidate_verifier_script"] == "modules/locations.core/verify/UokCandidateLocationMaster.ps1"
    assert set(manifest["commands"]) == {
        "CreateLocationDefinition",
        "UpdateLocationDefinition",
        "ArchiveLocationDefinition",
        "RestoreLocationDefinition",
    }
    assert set(manifest["events"]) == {
        "LocationDefinitionCreated",
        "LocationDefinitionUpdated",
        "LocationDefinitionArchived",
        "LocationDefinitionRestored",
    }
    assert set(manifest["permissions"]) == {"locations.read", "locations.manage"}
