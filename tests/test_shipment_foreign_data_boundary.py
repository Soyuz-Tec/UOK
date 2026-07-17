from __future__ import annotations

import pytest

from tests.shipment_foreign_data_boundary_support import (
    PLANNING_BACKEND,
    ROOT,
    SHIPMENT_BACKEND,
    SHIPMENT_MIGRATIONS,
    foreign_migration_tokens,
    planning_shipment_import_violations,
    python_violations,
)
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
        "contacts.core",
        "locations.core",
        "routes.core",
    ]
    assert manifest["api_prefixes"] == ["/api/shipments"]
    assert set(manifest["permissions"]) == {"shipments.read", "shipments.manage"}
    assert set(manifest["commands"]) == {
        "CreateShipment",
        "TransitionShipmentStatus",
        "UpdateShipment",
    }
    assert set(manifest["events"]) == {
        "ShipmentCreated",
        "ShipmentStatusTransitioned",
        "ShipmentUpdated",
    }
    assert {"Shipment", "ShipmentStatusHistory"}.issubset(
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


@pytest.mark.parametrize(
    "source",
    [
        "import uok_contacts_core.public_api as contacts_api",
        "from uok_contacts_core.public_api import api_router",
        "from uok_contacts_core._internal.persistence.models import Party",
        "from uok_product_master.public_api import api_router",
        "from uok_locations_core._internal.persistence.models import LocationDefinition",
        "from uok_routes_core._internal.persistence.models import RouteDefinition",
        "from importlib import import_module\nimport_module('uok_routes_core._internal')",
        "from sqlalchemy import text\nsession.execute(text('SELECT 1'))",
        "import sqlalchemy as sa\nsession.execute(sa.text('SELECT 1'))",
        "from sqlalchemy import MetaData\nmetadata = MetaData()\nmetadata.reflect(bind=engine)",
        "table = Shipment.__table__",
        "table = Base.metadata.tables['route_definitions']",
        "session.exec_driver_sql('SELECT 1')",
        "from sqlalchemy import ForeignKey\nForeignKey('location_definitions.id')",
    ],
)
def test_shipment_boundary_scanner_rejects_owner_bypasses(source: str) -> None:
    assert python_violations(source)


def test_shipment_boundary_scanner_allows_exact_owner_public_symbols() -> None:
    source = "\n".join(
        (
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
