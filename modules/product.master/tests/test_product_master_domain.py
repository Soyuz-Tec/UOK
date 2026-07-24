from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_product_master._internal.delivery.schemas import (
    ProductDefinitionCreateRequest,
    ProductDefinitionUpdateRequest,
)
from uok_product_master._internal.persistence.models import ProductDefinition, ProductNameHistory, owned_models
from uok_product_master.public_api import __all__ as public_symbols


def test_product_definition_input_normalizes_codes_and_optional_fields() -> None:
    request = ProductDefinitionCreateRequest(
        code="  rcn__supplier_grade_a  ",
        canonical_name="  Raw Cashew Nut  ",
        category="  Commodity  ",
        grade="   ",
        specification="  Contract specification  ",
        base_unit_code=" kg ",
    )

    assert request.model_dump() == {
        "code": "RCN-SUPPLIER-GRADE-A",
        "canonical_name": "Raw Cashew Nut",
        "category": "Commodity",
        "grade": None,
        "specification": "Contract specification",
        "base_unit_code": "KG",
    }


@pytest.mark.parametrize(
    "payload",
    [
        {"code": "***", "canonical_name": "Product"},
        {"code": "RCN", "canonical_name": "   "},
        {"code": "RCN", "canonical_name": "Product", "base_unit_code": "kg/mass"},
        {"code": "RCN", "canonical_name": "Product", "unexpected": True},
    ],
)
def test_product_definition_input_rejects_invalid_or_extra_fields(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        ProductDefinitionCreateRequest.model_validate(payload)


def test_update_contract_requires_a_positive_version_and_forbids_code_changes() -> None:
    with pytest.raises(ValidationError):
        ProductDefinitionUpdateRequest.model_validate({
            "product_definition_id": "product-1",
            "expected_version": 0,
            "canonical_name": "Updated",
        })
    with pytest.raises(ValidationError):
        ProductDefinitionUpdateRequest.model_validate({
            "product_definition_id": "product-1",
            "expected_version": 1,
            "code": "NEW-CODE",
        })


def test_product_master_owns_two_private_models_and_four_public_hooks() -> None:
    assert owned_models() == {
        "ProductDefinition": ProductDefinition,
        "ProductNameHistory": ProductNameHistory,
    }
    assert public_symbols == ["api_router", "command_handlers", "command_permissions", "role_grants"]
    assert ProductDefinition.__tablename__ == "product_definitions"
    assert ProductNameHistory.__tablename__ == "product_name_history"


def test_product_master_manifest_and_migration_declare_owner_contract() -> None:
    root = Path(__file__).parents[1]
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    migration = (root / "migrations" / "001_product_master.sql").read_text(encoding="utf-8")
    for value in (
        "uok_product_master.public_api:api_router",
        "uok_product_master._internal.persistence.models:owned_models",
        "ProductDefinition",
        "ProductNameHistory",
        "products.read",
        "products.manage",
    ):
        assert value in manifest
    assert "CREATE TABLE IF NOT EXISTS product_definitions" in migration
    assert "CREATE TABLE IF NOT EXISTS product_name_history" in migration
    assert "UNIQUE (organization_id, code)" in migration


def test_product_master_manifest_declares_the_exact_executable_boundary() -> None:
    manifest = load_module_manifests()["product.master"]

    assert manifest["required"] is False
    assert manifest["kind"] == "capability_module"
    assert manifest["maturity"] == "runtime_proven"
    assert manifest["dependencies"] == []
    assert manifest["backend_path"] == "modules/product.master/backend"
    assert manifest["api_prefixes"] == ["/api/products"]
    assert manifest["api_router"] == "uok_product_master.public_api:api_router"
    assert manifest["command_handlers"] == "uok_product_master.public_api:command_handlers"
    assert manifest["command_permissions"] == "uok_product_master.public_api:command_permissions"
    assert manifest["role_grants"] == "uok_product_master.public_api:role_grants"
    assert manifest["model_exports"] == (
        "uok_product_master._internal.persistence.models:owned_models"
    )
    assert manifest["candidate_verifier_script"] == (
        "modules/product.master/verify/UokCandidateProductMaster.ps1"
    )
    assert set(manifest["commands"]) == {
        "CreateProductDefinition",
        "UpdateProductDefinition",
        "ArchiveProductDefinition",
        "RestoreProductDefinition",
    }
    assert set(manifest["events"]) == {
        "ProductDefinitionCreated",
        "ProductDefinitionUpdated",
        "ProductDefinitionArchived",
        "ProductDefinitionRestored",
    }
    assert set(manifest["permissions"]) == {"products.read", "products.manage"}
