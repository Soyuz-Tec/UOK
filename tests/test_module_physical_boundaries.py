from __future__ import annotations

import re
import sys
from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.host.module_commands import command_permissions, load_module_command_handlers
from uok.host.module_paths import ensure_module_backend_paths, module_backend_paths, repo_root
from uok.host.module_policy import module_role_grants
from uok.host.module_routers import load_module_routers
from uok.module_tables import declared_module_table_names
from uok.modules import module_contracts
from tests.module_manifest_contract_assertions import (
    assert_file_backed_module_manifests,
)

BASELINE_MODULES = [
    "agents.core",
    "apps.manager",
    "calendar.core",
    "communications.core",
    "compliance.core",
    "contacts.core",
    "locations.core",
    "planning.core",
    "product.master",
    "reports.core",
    "routes.core",
    "shipments.core",
]


def test_file_backed_module_manifests_define_baseline_catalog() -> None:
    assert_file_backed_module_manifests(BASELINE_MODULES)


def test_contacts_core_backend_loads_from_physical_module_root() -> None:
    ensure_module_backend_paths()

    from uok_contacts_core.public_api import PartyReferenceResolution

    contacts_api = sys.modules[PartyReferenceResolution.__module__]

    backend_file = Path(contacts_api.__file__).resolve()
    assert "modules" in backend_file.parts
    assert "contacts.core" in backend_file.parts
    assert set(contacts_api.__all__) == {
        "PartyReferenceResolution",
        "api_router",
        "command_handlers",
        "command_permissions",
        "dashboard_counts",
        "evidence",
        "resolve_party_reference",
        "role_grants",
    }


def test_module_extension_contract_is_enforced() -> None:
    contracts = module_contracts()

    assert contracts["ok"] is True
    extension_contract = contracts["extension_contract"]
    assert extension_contract["ok"] is True
    assert extension_contract["checks"]["required_modules"] == ["apps.manager"]
    assert extension_contract["checks"]["all_paths_module_scoped"] is True
    assert extension_contract["checks"]["api_routers_valid"] is True
    assert extension_contract["checks"]["command_handlers_valid"] is True
    assert extension_contract["checks"]["role_grants_valid"] is True
    assert extension_contract["checks"]["dashboard_providers_valid"] is True
    assert extension_contract["checks"]["evidence_providers_valid"] is True
    assert extension_contract["checks"]["model_exports_valid"] is True
    assert extension_contract["checks"]["candidate_verifiers_valid"] is True
    assert extension_contract["checks"]["owned_table_claims_valid"] is True
    assert extension_contract["checks"]["owned_tables_resolve_to_models"] is True
    assert contracts["model_registry"]["ok"] is True
    assert contracts["model_registry"]["model_count"] == 62
    assert extension_contract["violations"] == []


def test_kernel_does_not_statically_import_module_backends() -> None:
    package_names = set()
    for backend_dir in module_backend_paths():
        for child in sorted(backend_dir.iterdir()):
            if child.is_dir() and (child / "__init__.py").is_file():
                package_names.add(child.name)
    expected_packages = {
        f"uok_{name.replace('.', '_')}" for name in BASELINE_MODULES if name != "agents.core"
    }
    assert expected_packages.issubset(package_names)

    import_pattern = re.compile(rf"^\s*(?:from|import)\s+(?:{'|'.join(sorted(package_names))})\b", re.MULTILINE)
    offenders = sorted(
        path.relative_to(repo_root()).as_posix()
        for path in (repo_root() / "src" / "uok").rglob("*.py")
        if import_pattern.search(path.read_text(encoding="utf-8"))
    )
    assert offenders == []


def test_module_routers_mount_from_manifest_declarations() -> None:
    manifests = load_module_manifests()
    routers = load_module_routers()

    assert [module_name for module_name, _ in routers] == [
        name for name in BASELINE_MODULES if manifests[name].get("api_router")
    ]
    for module_name, router in routers:
        prefixes = manifests[module_name]["api_prefixes"]
        assert router.routes
        for route in router.routes:
            assert any(route.path == prefix or route.path.startswith(prefix + "/") for prefix in prefixes)


def test_module_commands_permissions_roles_and_tables_load_from_manifests() -> None:
    handlers = load_module_command_handlers()
    permissions = command_permissions()
    grants = module_role_grants()

    assert "CreateContact" in handlers
    assert "CreateCalendarEvent" in handlers
    assert "CreateCommunicationThread" in handlers
    assert {
        "CreateComplianceDocumentType",
        "UpdateComplianceDocumentType",
        "DeactivateComplianceDocumentType",
        "ActivateComplianceDocumentType",
        "ArchiveComplianceDocumentType",
        "RestoreComplianceDocumentType",
    }.issubset(handlers)
    for entity in ("Product", "Location", "Route"):
        for action in ("Create", "Update", "Archive", "Restore"):
            assert f"{action}{entity}Definition" in handlers
    shipment_commands = {
        "AddShipmentDocumentRequirement",
        "CreateShipment",
        "RemoveShipmentDocumentRequirement",
        "SetShipmentDocumentRequirementStatus",
        "TransitionShipmentStatus",
        "UpdateShipment",
        "UpdateShipmentDocumentRequirement",
    }
    assert shipment_commands.issubset(handlers)
    assert "ImportContactsCsv" in handlers
    assert "GenerateReport" in handlers
    assert "DeleteReportArtifact" in handlers
    assert permissions["CreateContact"] == "contacts.manage"
    assert permissions["CreateCalendarEvent"] == "calendar.event.create"
    assert permissions["CreateCommunicationThread"] == "communications.edit"
    for command_name in (
        "CreateComplianceDocumentType",
        "UpdateComplianceDocumentType",
        "DeactivateComplianceDocumentType",
        "ActivateComplianceDocumentType",
        "ArchiveComplianceDocumentType",
        "RestoreComplianceDocumentType",
    ):
        assert permissions[command_name] == "compliance.manage"
    assert permissions["CreatePlanningProject"] == "planning.edit"
    assert permissions["CreatePlanningBaseline"] == "planning.baseline.create"
    assert permissions["LevelPlanningResources"] == "planning.level"
    assert permissions["CreatePlanningWhatIfSnapshot"] == "planning.analyze"
    assert permissions["RunPlanningRiskAnalysis"] == "planning.analyze"
    assert permissions["RunPlanningOptimization"] == "planning.analyze"
    assert permissions["DecidePlanningRecommendation"] == "planning.analysis.approve"
    for entity, permission in (("Product", "products.manage"), ("Location", "locations.manage"), ("Route", "routes.manage")):
        for action in ("Create", "Update", "Archive", "Restore"):
            assert permissions[f"{action}{entity}Definition"] == permission
    for command_name in shipment_commands:
        assert permissions[command_name] == "shipments.manage"
    assert permissions["RestoreContact"] == "contacts.restore"
    assert permissions["GenerateReport"] == "reports.render"
    assert permissions["DeleteReportArtifact"] == "reports.delete"
    assert permissions["VerifyBaseline"] == "migration.verify"
    assert "contacts.manage" in grants["ops_manager"]
    assert "calendar.manage" in grants["ops_manager"]
    assert "planning.edit" in grants["ops_manager"]
    assert "planning.baseline.create" in grants["ops_manager"]
    assert "planning.level" in grants["ops_manager"]
    assert "planning.admin" in grants["ops_manager"]
    assert "planning.analyze" in grants["ops_manager"]
    assert "planning.analysis.approve" in grants["ops_manager"]
    assert "communications.edit" in grants["ops_manager"]
    assert "compliance.manage" in grants["ops_manager"]
    assert "compliance.read" in grants["viewer"]
    assert grants["trader"] >= {"planning.read", "planning.edit"}
    assert "reports.manage" in grants["ops_manager"]
    assert "products.manage" in grants["ops_manager"]
    assert "products.read" in grants["viewer"]
    assert grants["ops_manager"] >= {"locations.manage", "routes.manage"}
    assert grants["viewer"] >= {"locations.read", "routes.read"}
    assert "shipments.manage" in grants["ops_manager"]
    assert "shipments.read" in grants["viewer"]
    assert "contacts.read" in grants["viewer"]
    assert "calendar.read" in grants["viewer"]
    assert "reports.read" in grants["viewer"]
    assert {
        "calendars",
        "calendar_events",
        "calendar_event_participants",
        "calendar_reminders",
        "communication_threads",
        "compliance_document_types",
        "compliance_document_type_name_history",
        "parties",
        "party_notes",
        "party_relationships",
        "contact_import_batches",
        "planning_projects",
        "planning_tasks",
        "planning_task_dependencies",
        "planning_resource_calendars",
        "location_definitions",
        "location_name_history",
        "product_definitions",
        "product_name_history",
        "report_artifacts",
        "shipments",
        "shipment_document_requirements",
        "shipment_document_requirement_history",
        "shipment_status_history",
    }.issubset(declared_module_table_names())


def test_app_composes_module_routes_without_kernel_module_references() -> None:
    from uok.host.application import app

    app_paths = set(app.openapi()["paths"])
    assert "/api/contacts" in app_paths
    assert "/api/calendar/calendars" in app_paths
    assert "/api/contacts/review-queue" in app_paths
    assert "/api/planning/projects" in app_paths
    assert "/api/planning/projects/{project_id}/resources/{resource_id}/calendar" in app_paths
    assert "/api/products/definitions" in app_paths
    assert "/api/compliance/document-types" in app_paths
    assert "/api/locations/definitions" in app_paths
    assert (
        "/api/products/definitions/{product_definition_id}/name-history"
        in app_paths
    )
    assert "/api/locations/definitions/{location_definition_id}/name-history" in app_paths
    assert "/api/shipments/records" in app_paths
    assert "/api/shipments/document-type-options" in app_paths
    assert (
        "/api/shipments/records/{shipment_id}/document-requirements"
        in app_paths
    )
    assert (
        "/api/shipments/records/{shipment_id}/document-requirements/"
        "{requirement_id}/history"
        in app_paths
    )
    assert "/api/reports/formats" in app_paths

    main_source = (repo_root() / "src" / "uok" / "host" / "application.py").read_text(encoding="utf-8")
    assert "contacts" not in main_source.lower()
