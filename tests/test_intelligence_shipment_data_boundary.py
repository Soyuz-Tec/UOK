from __future__ import annotations

import json

import pytest

from tests.intelligence_shipment_data_boundary_support import (
    INTELLIGENCE_BACKEND,
    INTELLIGENCE_MIGRATIONS,
    INTELLIGENCE_WEB,
    ROOT,
    SHIPMENT_BACKEND,
    intelligence_frontend_violations,
    intelligence_persistence_violations,
    intelligence_python_violations,
    shipment_reverse_import_violations,
)
from uok.module_manifest_loader import load_module_manifests


def test_intelligence_backend_uses_only_shipment_readiness_public_contract() -> None:
    assert INTELLIGENCE_BACKEND.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(INTELLIGENCE_BACKEND.rglob("*.py"))
        for line, reason in intelligence_python_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []


def test_shipments_has_no_reverse_intelligence_dependency() -> None:
    assert SHIPMENT_BACKEND.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(SHIPMENT_BACKEND.rglob("*.py"))
        for line, reason in shipment_reverse_import_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []


def test_intelligence_is_stateless_and_declares_only_advisory_reads() -> None:
    manifest = load_module_manifests()["intelligence.core"]
    assert manifest["required"] is False
    assert manifest["kind"] == "capability_module"
    assert manifest["dependencies"] == ["shipments.core"]
    assert manifest["api_prefixes"] == ["/api/intelligence"]
    assert manifest["permissions"] == ["intelligence.read"]
    assert manifest["commands"] == []
    assert manifest["events"] == []
    assert manifest["owned_tables"] == []
    assert "model_exports" not in manifest
    assert "model_exports" not in manifest["extension_points"]

    assert INTELLIGENCE_MIGRATIONS.is_dir()
    assert list(INTELLIGENCE_MIGRATIONS.rglob("*.sql")) == []
    persistence_hits = [
        f"{path.relative_to(ROOT).as_posix()}: {token}"
        for path in sorted(INTELLIGENCE_BACKEND.rglob("*.py"))
        for token in intelligence_persistence_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert persistence_hits == []


def test_intelligence_frontend_uses_only_its_owner_http_surface() -> None:
    assert INTELLIGENCE_WEB.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(INTELLIGENCE_WEB.rglob("*"))
        if path.is_file() and path.suffix in {".ts", ".tsx"}
        for line, reason in intelligence_frontend_violations(
            path.read_text(encoding="utf-8")
        )
    ]
    assert violations == []


def test_intelligence_http_contract_has_no_write_operation() -> None:
    from uok.host.application import app

    operations = {
        path: definition
        for path, definition in app.openapi()["paths"].items()
        if path.startswith("/api/intelligence")
    }
    assert set(operations) == {"/api/intelligence/shipment-readiness"}
    assert set(operations["/api/intelligence/shipment-readiness"]) == {"get"}
    parameters = operations["/api/intelligence/shipment-readiness"]["get"][
        "parameters"
    ]
    as_of = next(value for value in parameters if value["name"] == "as_of")
    assert as_of["in"] == "query"
    assert as_of["required"] is True
    assert as_of["schema"]["format"] == "date"
    contract = json.dumps(operations, sort_keys=True).casefold()
    assert "/api/shipments" not in contract


@pytest.mark.parametrize(
    "source",
    [
        "import uok_shipments_core.public_api as shipments_api",
        "from uok_shipments_core.public_api import api_router",
        "from uok_shipments_core.public_api import *",
        "from uok_shipments_core._internal.persistence.models import Shipment",
        "from uok_shipments_core._internal.delivery.read_service import get_shipment",
        "from importlib import import_module\n"
        "import_module('uok_shipments_core.public_api')",
        "import uok_compliance_core.public_api",
        "from uok_contacts_core.public_api import resolve_party_reference",
        "from uok_locations_core.public_api import resolve_location_references",
        "from uok_routes_core.public_api import resolve_route_reference",
        "from uok_planning_core.public_api import api_router",
        "from uok_product_master.public_api import api_router",
        "from uok_reports_core.public_api import api_router",
        "from sqlalchemy import text\nsession.execute(text('SELECT 1'))",
        "import sqlalchemy as sa\nsession.execute(sa.text('SELECT 1'))",
        "from sqlalchemy import MetaData\nmetadata = MetaData()\nmetadata.reflect(bind=engine)",
        "table = Shipment.__table__",
        "table = Base.metadata.tables['shipments']",
        "session.exec_driver_sql('SELECT * FROM shipments')",
        "from sqlalchemy import ForeignKey\nForeignKey('shipments.id')",
    ],
)
def test_intelligence_boundary_scanner_rejects_shipment_bypasses(
    source: str,
) -> None:
    assert intelligence_python_violations(source)


def test_intelligence_boundary_scanner_allows_exact_shipment_public_symbols() -> None:
    source = (
        "from uok_shipments_core.public_api import "
        "ShipmentReadinessSnapshotDTO, resolve_shipment_readiness_snapshots"
    )
    assert intelligence_python_violations(source) == []


@pytest.mark.parametrize(
    "source",
    [
        "import uok_intelligence_core",
        "from uok_intelligence_core.public_api import api_router",
        "from importlib import import_module\n"
        "import_module('uok_intelligence_core.public_api')",
    ],
)
def test_reverse_dependency_scanner_rejects_shipments_to_intelligence(
    source: str,
) -> None:
    assert shipment_reverse_import_violations(source)


@pytest.mark.parametrize(
    "source",
    [
        'fetch("/api/shipments/records")',
        'import { loadShipments } from "@uok-modules/shipments.core/web/src/api"',
        'const workspace = import("../../shipments.core/web/src/ShipmentSupportWorkspace")',
    ],
)
def test_intelligence_frontend_scanner_rejects_shipment_bypasses(
    source: str,
) -> None:
    assert intelligence_frontend_violations(source)


def test_intelligence_frontend_scanner_allows_owner_http_path() -> None:
    assert intelligence_frontend_violations(
        'fetch("/api/intelligence/shipment-readiness?as_of=2026-07-23")'
    ) == []
