from __future__ import annotations

import pytest

from tests.compliance_document_type_data_boundary_support import (
    COMPLIANCE_BACKEND,
    COMPLIANCE_MIGRATIONS,
    ROOT,
    feature_backend_packages,
    foreign_migration_tokens,
    python_violations,
)
from uok.module_manifest_loader import load_module_manifests


def test_compliance_backend_has_no_foreign_feature_dependency() -> None:
    assert COMPLIANCE_BACKEND.is_dir()
    assert feature_backend_packages() >= {
        "uok_contacts_core",
        "uok_locations_core",
        "uok_product_master",
        "uok_routes_core",
        "uok_shipments_core",
    }
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(COMPLIANCE_BACKEND.rglob("*.py"))
        for line, reason in python_violations(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_compliance_migrations_never_reference_foreign_owner_tables() -> None:
    assert COMPLIANCE_MIGRATIONS.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: foreign owner table {table_name}"
        for path in sorted(COMPLIANCE_MIGRATIONS.glob("*.sql"))
        for table_name in foreign_migration_tokens(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_compliance_manifest_declares_no_feature_dependencies() -> None:
    manifest = load_module_manifests()["compliance.core"]
    assert manifest["required"] is False
    assert manifest["kind"] == "capability_module"
    assert manifest["dependencies"] == []
    assert manifest["api_prefixes"] == ["/api/compliance"]
    assert set(manifest["permissions"]) == {
        "compliance.read",
        "compliance.manage",
    }
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
    assert {
        "ComplianceDocumentType",
        "ComplianceDocumentTypeNameHistory",
    }.issubset(set(manifest["owned_tables"]))


@pytest.mark.parametrize(
    "source",
    [
        "import uok_contacts_core.public_api as contacts_api",
        "from uok_locations_core.public_api import resolve_location_references",
        "from uok_shipments_core._internal.persistence.models import Shipment",
        "from uok_shipments_core._internal.persistence.document_instance_models "
        "import ShipmentDocumentInstance",
        "from importlib import import_module\nimport_module('uok_routes_core.public_api')",
        "from uok.models import Party",
        "from sqlalchemy import text\nsession.execute(text('SELECT 1'))",
        "import sqlalchemy as sa\nsession.execute(sa.text('SELECT 1'))",
        "from sqlalchemy import MetaData\nmetadata = MetaData()\nmetadata.reflect(bind=engine)",
        "table = ComplianceDocumentType.__table__",
        "table = Base.metadata.tables['shipments']",
        "session.exec_driver_sql('SELECT 1')",
        "from sqlalchemy import ForeignKey\nForeignKey('location_definitions.id')",
        "from sqlalchemy import ForeignKey\n"
        "ForeignKey('shipment_document_instances.id')",
    ],
)
def test_compliance_boundary_scanner_rejects_foreign_data_bypasses(
    source: str,
) -> None:
    assert python_violations(source)


def test_compliance_boundary_scanner_allows_owner_and_kernel_contracts() -> None:
    source = "\n".join(
        (
            "from uok_compliance_core._internal.persistence.models import "
            "ComplianceDocumentType",
            "from uok.kernel.persistence import Base",
            "from uok.kernel.security import Actor",
        )
    )
    assert python_violations(source) == []
