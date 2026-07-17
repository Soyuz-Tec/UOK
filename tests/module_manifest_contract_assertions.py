from __future__ import annotations

from collections.abc import Sequence

from uok.host.module_paths import modules_root
from uok.module_manifest_loader import load_module_manifests


def assert_file_backed_module_manifests(baseline_modules: Sequence[str]) -> None:
    root = modules_root()
    manifests = load_module_manifests(root)

    assert sorted(manifests) == list(baseline_modules)
    for module_name in manifests:
        module_dir = root / module_name
        assert manifests[module_name]["manifest_schema"] == "uok.module.v1"
        assert (module_dir / "manifest.yaml").is_file()
        assert (module_dir / "backend").is_dir()
        assert (module_dir / "web").is_dir()
        assert (module_dir / "migrations").is_dir()
        assert (module_dir / "tests").is_dir()

    assert manifests["apps.manager"]["required"] is True
    assert manifests["apps.manager"]["maturity"] == "runtime_proven"
    assert manifests["apps.manager"]["api_router"] == "uok_apps_manager.api:router"
    assert (
        manifests["apps.manager"]["candidate_verifier_script"]
        == "modules/apps.manager/verify/UokCandidateAppsManager.ps1"
    )
    agents = manifests["agents.core"]
    assert agents["required"] is False
    assert agents["maturity"] == "planned"
    assert agents["installable"] is False
    assert agents["lifecycle"] == ["planned"]
    assert agents["backend_path"] == "modules/agents.core/backend"
    assert agents["commands"] == []
    assert agents["events"] == []
    assert agents["permissions"] == []
    assert agents["extension_points"] == []

    calendar = manifests["calendar.core"]
    assert calendar["required"] is False
    assert calendar["backend_path"] == "modules/calendar.core/backend"
    assert calendar["api_router"] == "uok_calendar_core.api:router"
    assert calendar["command_handlers"] == "uok_calendar_core.commands:command_handlers"
    assert (
        calendar["command_permissions"]
        == "uok_calendar_core.commands:command_permissions"
    )
    assert calendar["role_grants"] == "uok_calendar_core.policy:role_grants"
    assert calendar["model_exports"] == "uok_calendar_core.models:owned_models"
    assert (
        calendar["candidate_verifier_script"]
        == "modules/calendar.core/verify/UokCandidateCalendar.ps1"
    )
    assert "/api/calendar" in calendar["api_prefixes"]
    assert "CreateCalendarEvent" in calendar["commands"]
    assert "calendar.read" in calendar["permissions"]

    communications = manifests["communications.core"]
    assert communications["api_router"] == "uok_communications_core.api:router"
    assert (
        communications["command_handlers"]
        == "uok_communications_core.commands:command_handlers"
    )
    assert "CreateCommunicationThread" in communications["commands"]
    assert "communications.read" in communications["permissions"]

    contacts = manifests["contacts.core"]
    assert contacts["required"] is False
    assert "CreateContact" in contacts["commands"]
    assert "ContactCreated" in contacts["events"]
    assert contacts["backend_path"] == "modules/contacts.core/backend"
    assert "/api/contacts" in contacts["api_prefixes"]
    assert contacts["api_router"] == "uok_contacts_core.public_api:api_router"
    assert (
        contacts["command_handlers"]
        == "uok_contacts_core.public_api:command_handlers"
    )
    assert (
        contacts["command_permissions"]
        == "uok_contacts_core.public_api:command_permissions"
    )
    assert contacts["role_grants"] == "uok_contacts_core.public_api:role_grants"
    assert (
        contacts["dashboard_provider"]
        == "uok_contacts_core.public_api:dashboard_counts"
    )
    assert contacts["evidence_provider"] == "uok_contacts_core.public_api:evidence"
    assert (
        contacts["model_exports"]
        == "uok_contacts_core._internal.persistence.models:owned_models"
    )
    assert (
        contacts["candidate_verifier_script"]
        == "modules/contacts.core/verify/UokCandidateContacts.ps1"
    )
    assert "contacts.manage" in contacts["permissions"]
    assert (
        root
        / "contacts.core"
        / "migrations"
        / "001_contacts_core_operational_indexes.sql"
    ).is_file()

    locations = manifests["locations.core"]
    assert locations["required"] is False
    assert locations["dependencies"] == []
    assert locations["api_prefixes"] == ["/api/locations"]
    assert set(locations["permissions"]) == {"locations.read", "locations.manage"}
    assert set(locations["commands"]) == {
        f"{action}LocationDefinition"
        for action in ("Create", "Update", "Archive", "Restore")
    }
    assert set(locations["events"]) == {
        f"LocationDefinition{action}"
        for action in ("Created", "Updated", "Archived", "Restored")
    }

    shipments = manifests["shipments.core"]
    assert shipments["required"] is False
    assert shipments["kind"] == "business_module"
    assert shipments["dependencies"] == [
        "contacts.core",
        "locations.core",
        "routes.core",
    ]
    assert shipments["api_prefixes"] == ["/api/shipments"]
    assert set(shipments["permissions"]) == {"shipments.read", "shipments.manage"}
    assert shipments["api_router"] == "uok_shipments_core.public_api:api_router"
    assert (
        shipments["command_handlers"]
        == "uok_shipments_core.public_api:command_handlers"
    )
    assert (
        shipments["command_permissions"]
        == "uok_shipments_core.public_api:command_permissions"
    )
    assert shipments["role_grants"] == "uok_shipments_core.public_api:role_grants"
    assert (
        shipments["model_exports"]
        == "uok_shipments_core._internal.persistence.models:owned_models"
    )
    assert (
        shipments["candidate_verifier_script"]
        == "modules/shipments.core/verify/UokCandidateShipmentSupport.ps1"
    )
    assert set(shipments["commands"]) == {
        "CreateShipment",
        "TransitionShipmentStatus",
        "UpdateShipment",
    }
    assert set(shipments["events"]) == {
        "ShipmentCreated",
        "ShipmentStatusTransitioned",
        "ShipmentUpdated",
    }
    assert {"Shipment", "ShipmentStatusHistory"}.issubset(
        set(shipments["owned_tables"])
    )

    planning = manifests["planning.core"]
    assert planning["required"] is False
    assert planning["backend_path"] == "modules/planning.core/backend"
    assert planning["dependencies"] == ["calendar.core"]
    assert planning["api_router"] == "uok_planning_core.public_api:api_router"
    assert (
        planning["command_handlers"]
        == "uok_planning_core.public_api:command_handlers"
    )
    assert (
        planning["command_permissions"]
        == "uok_planning_core.public_api:command_permissions"
    )
    assert "SetPlanningResourceCalendar" in planning["commands"]
    assert "PlanningResourceCalendarUpdated" in planning["events"]
    assert (
        planning["candidate_verifier_script"]
        == "modules/planning.core/verify/UokCandidatePlanning.ps1"
    )
    assert "CreatePlanningProject" in planning["commands"]
    assert "PlanningTaskLinked" in planning["events"]
    assert set(planning["permissions"]) == {
        "planning.read",
        "planning.edit",
        "planning.baseline.create",
        "planning.level",
        "planning.link",
        "planning.gate.approve",
        "planning.admin",
        "planning.analyze",
        "planning.analysis.approve",
    }

    reports = manifests["reports.core"]
    assert reports["required"] is False
    assert reports["kind"] == "capability_module"
    assert "GenerateReport" in reports["commands"]
    assert "ReportGenerated" in reports["events"]
    assert reports["backend_path"] == "modules/reports.core/backend"
    assert "/api/reports" in reports["api_prefixes"]
    assert reports["api_router"] == "uok_reports_core.api:router"
    assert reports["command_handlers"] == "uok_reports_core.commands:command_handlers"
    assert (
        reports["command_permissions"]
        == "uok_reports_core.commands:command_permissions"
    )
    assert reports["role_grants"] == "uok_reports_core.policy:role_grants"
    assert reports["model_exports"] == "uok_reports_core.models:owned_models"
    assert (
        reports["candidate_verifier_script"]
        == "modules/reports.core/verify/UokCandidateReports.ps1"
    )
    assert "reports.render" in reports["permissions"]


__all__ = ["assert_file_backed_module_manifests"]
