from __future__ import annotations

import json
import re

import pytest

from tests.shipment_document_instance_boundary_support import (
    SHIPMENT_WEB,
    backend_file_pipeline_violations,
    document_storage_schema_violations,
    frontend_file_pipeline_violations,
)
from tests.shipment_foreign_data_boundary_support import (
    PLANNING_BACKEND,
    ROOT,
    SHIPMENT_BACKEND,
    SHIPMENT_MIGRATIONS,
    foreign_migration_tokens,
    planning_shipment_import_violations,
    python_violations,
)
from uok.host.model_registry import ensure_module_models_registered
from uok.module_manifest_loader import load_module_manifests


def test_shipment_backend_uses_only_exact_owner_public_contracts() -> None:
    assert SHIPMENT_BACKEND.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(SHIPMENT_BACKEND.rglob("*.py"))
        for line, reason in python_violations(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_shipment_migrations_never_reference_foreign_owner_tables() -> None:
    assert SHIPMENT_MIGRATIONS.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: foreign owner table {table_name}"
        for path in sorted(SHIPMENT_MIGRATIONS.glob("*.sql"))
        for table_name in foreign_migration_tokens(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_shipment_manifest_declares_only_approved_feature_dependencies() -> None:
    manifest = load_module_manifests()["shipments.core"]
    assert manifest["required"] is False
    assert manifest["kind"] == "business_module"
    assert manifest["dependencies"] == [
        "compliance.core",
        "contacts.core",
        "locations.core",
        "routes.core",
    ]
    assert manifest["api_prefixes"] == ["/api/shipments"]
    assert set(manifest["permissions"]) == {"shipments.read", "shipments.manage"}
    assert set(manifest["commands"]) == {
        "CreateShipment",
        "CreateShipmentDocumentInstance",
        "AddShipmentDocumentRequirement",
        "RemoveShipmentDocumentRequirement",
        "SetShipmentDocumentInstanceStatus",
        "SetShipmentDocumentRequirementStatus",
        "TransitionShipmentStatus",
        "UpdateShipmentDocumentInstance",
        "UpdateShipmentDocumentRequirement",
        "UpdateShipment",
    }
    assert set(manifest["events"]) == {
        "ShipmentCreated",
        "ShipmentDocumentInstanceCreated",
        "ShipmentDocumentInstanceStatusChanged",
        "ShipmentDocumentInstanceUpdated",
        "ShipmentDocumentRequirementAdded",
        "ShipmentDocumentRequirementRemoved",
        "ShipmentDocumentRequirementStatusChanged",
        "ShipmentDocumentRequirementUpdated",
        "ShipmentStatusTransitioned",
        "ShipmentUpdated",
    }
    assert {
        "Shipment",
        "ShipmentDocumentInstance",
        "ShipmentDocumentInstanceHistory",
        "ShipmentDocumentRequirement",
        "ShipmentDocumentRequirementHistory",
        "ShipmentStatusHistory",
    }.issubset(
        set(manifest["owned_tables"])
    )


def test_planning_consumes_shipment_only_through_the_public_reference_contract() -> None:
    assert PLANNING_BACKEND.is_dir()
    sources = [
        path.read_text(encoding="utf-8")
        for path in sorted(PLANNING_BACKEND.rglob("*.py"))
    ]
    violations = [
        f"{line}: {reason}"
        for source in sources
        for line, reason in planning_shipment_import_violations(source)
    ]
    assert violations == []
    assert any("uok_shipments_core.public_api" in source for source in sources)


def test_shipment_document_instance_models_have_no_binary_or_foreign_storage() -> None:
    models = ensure_module_models_registered()
    instance = models["ShipmentDocumentInstance"].__table__
    history = models["ShipmentDocumentInstanceHistory"].__table__

    for table in (instance, history):
        assert document_storage_schema_violations(
            "\n".join(
                f"{column.name} {type(column.type).__name__} {column.type}"
                for column in table.columns
            )
        ) == []
        assert all(
            not foreign_key.target_fullname.startswith(
                "compliance_document_types."
            )
            for column in table.columns
            for foreign_key in column.foreign_keys
        )

    assert list(instance.c.compliance_document_type_id.foreign_keys) == []
    assert {
        foreign_key.target_fullname
        for foreign_key in instance.c.requirement_id.foreign_keys
    } == {"shipment_document_requirements.id"}
    assert list(history.c.compliance_document_type_id.foreign_keys) == []
    assert list(history.c.requirement_id.foreign_keys) == []


def test_shipment_document_instance_migration_has_no_binary_or_storage_contract() -> None:
    instance_migrations = sorted(SHIPMENT_MIGRATIONS.glob("*document_instance*.sql"))
    assert instance_migrations
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: {reason}"
        for path in instance_migrations
        for reason in document_storage_schema_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []


def test_shipment_document_instance_backend_has_no_file_pipeline() -> None:
    instance_sources = sorted(SHIPMENT_BACKEND.rglob("*document_instance*.py"))
    assert instance_sources
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: {reason}"
        for path in instance_sources
        for reason in backend_file_pipeline_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []


def test_shipment_document_instance_openapi_has_no_binary_or_multipart_contract() -> None:
    from uok.host.application import app

    openapi = app.openapi()
    instance_paths = {
        path: definition
        for path, definition in openapi["paths"].items()
        if path.startswith("/api/shipments/")
        and "/document-instances" in path
    }
    instance_schemas = {
        name: definition
        for name, definition in openapi["components"]["schemas"].items()
        if "documentinstance" in name.casefold()
    }

    assert instance_paths
    assert instance_schemas
    contract = json.dumps(
        {"paths": instance_paths, "schemas": instance_schemas},
        sort_keys=True,
    ).casefold()
    assert "multipart/form-data" not in contract
    assert '"format": "binary"' not in contract
    assert document_storage_schema_violations(contract) == []


def test_shipment_document_instance_frontend_has_no_file_pipeline_or_foreign_api() -> None:
    assert SHIPMENT_WEB.is_dir()
    instance_sources = [
        path
        for path in sorted(SHIPMENT_WEB.rglob("*"))
        if path.is_file()
        and path.suffix in {".ts", ".tsx"}
        and "instance" in path.name.casefold()
    ]
    assert instance_sources
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: {reason}"
        for path in instance_sources
        for reason in frontend_file_pipeline_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []
    combined = "\n".join(
        path.read_text(encoding="utf-8") for path in instance_sources
    )
    assert "/api/compliance" not in combined
    assert "uok_compliance_core" not in combined
    api_paths = re.findall(r"""["'`](/api/[^"'`]+)""", combined)
    assert api_paths
    assert all(
        path.startswith("/api/shipments/") or path == "/api/commands"
        for path in api_paths
    )


@pytest.mark.parametrize(
    "source",
    [
        "import uok_compliance_core.public_api as compliance_api",
        "from uok_compliance_core.public_api import api_router",
        "from uok_compliance_core._internal.persistence.models import ComplianceDocumentType",
        "import uok_contacts_core.public_api as contacts_api",
        "from uok_contacts_core.public_api import api_router",
        "from uok_contacts_core._internal.persistence.models import Party",
        "from uok_product_master.public_api import api_router",
        "from uok_locations_core._internal.persistence.models import LocationDefinition",
        "from uok_routes_core._internal.persistence.models import RouteDefinition",
        "from importlib import import_module\nimport_module('uok_routes_core._internal')",
        "from importlib import import_module\n"
        "import_module('uok_compliance_core.public_api')",
        "from sqlalchemy import text\nsession.execute(text('SELECT 1'))",
        "import sqlalchemy as sa\nsession.execute(sa.text('SELECT 1'))",
        "from sqlalchemy import MetaData\nmetadata = MetaData()\nmetadata.reflect(bind=engine)",
        "table = Shipment.__table__",
        "table = Base.metadata.tables['route_definitions']",
        "session.exec_driver_sql('SELECT 1')",
        "from sqlalchemy import ForeignKey\nForeignKey('location_definitions.id')",
        "from sqlalchemy import ForeignKey\n"
        "ForeignKey('compliance_document_types.id')",
    ],
)
def test_shipment_boundary_scanner_rejects_owner_bypasses(source: str) -> None:
    assert python_violations(source)


def test_shipment_boundary_scanner_allows_exact_owner_public_symbols() -> None:
    source = "\n".join(
        (
            "from uok_compliance_core.public_api import "
            "ComplianceDocumentTypeReferenceDTO, "
            "resolve_compliance_document_type_references",
            "from uok_contacts_core.public_api import "
            "PartyReferenceResolution, resolve_party_reference",
            "from uok_locations_core.public_api import "
            "LocationReferenceResolution, resolve_location_references",
            "from uok_routes_core.public_api import "
            "RoutePathReferenceDTO, resolve_route_path_references",
        )
    )
    assert python_violations(source) == []


@pytest.mark.parametrize(
    "source",
    [
        "import uok_shipments_core.public_api as shipment_api",
        "from uok_shipments_core.public_api import api_router",
        "from uok_shipments_core._internal.persistence.models import Shipment",
        "from importlib import import_module\nimport_module('uok_shipments_core._internal')",
    ],
)
def test_planning_shipment_scanner_rejects_facade_bypasses(source: str) -> None:
    assert planning_shipment_import_violations(source)


def test_planning_shipment_scanner_allows_exact_public_symbols() -> None:
    source = (
        "from uok_shipments_core.public_api import "
        "ShipmentReferenceDTO, resolve_shipment_reference"
    )
    assert planning_shipment_import_violations(source) == []
