from __future__ import annotations

import re
from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.module_paths import ensure_module_backend_paths, module_backend_paths, modules_root, repo_root
from uok.module_routers import load_module_routers
from uok.module_commands import command_permissions, load_module_command_handlers
from uok.module_policy import module_role_grants
from uok.module_tables import declared_module_table_names
from uok.modules import module_contracts

KERNEL_MODULE_FACADE_FILES = {
    "src/uok/contacts.py",
    "src/uok/contacts_commands.py",
    "src/uok/contact_access.py",
    "src/uok/contact_api_schemas.py",
    "src/uok/contact_command_support.py",
    "src/uok/contact_duplicates.py",
    "src/uok/contact_import_commands.py",
    "src/uok/contact_read_model.py",
    "src/uok/contact_validation.py",
}
BASELINE_MODULES = ["agents.core", "apps.manager", "calendar.core", "communications.core", "contacts.core", "planning.core", "reports.core"]


def test_file_backed_module_manifests_define_baseline_catalog() -> None:
    root = modules_root()
    manifests = load_module_manifests(root)

    assert sorted(manifests) == BASELINE_MODULES
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
    assert manifests["apps.manager"]["candidate_verifier_script"] == "modules/apps.manager/verify/UokCandidateAppsManager.ps1"
    assert manifests["agents.core"]["required"] is False
    assert manifests["agents.core"]["maturity"] == "planned"
    assert manifests["agents.core"]["installable"] is False
    assert manifests["agents.core"]["lifecycle"] == ["planned"]
    assert manifests["agents.core"]["backend_path"] == "modules/agents.core/backend"
    assert manifests["agents.core"]["commands"] == []
    assert manifests["agents.core"]["events"] == []
    assert manifests["agents.core"]["permissions"] == []
    assert manifests["agents.core"]["extension_points"] == []
    assert manifests["calendar.core"]["required"] is False
    assert manifests["calendar.core"]["backend_path"] == "modules/calendar.core/backend"
    assert manifests["calendar.core"]["api_router"] == "uok_calendar_core.api:router"
    assert manifests["calendar.core"]["command_handlers"] == "uok_calendar_core.commands:command_handlers"
    assert manifests["calendar.core"]["command_permissions"] == "uok_calendar_core.commands:command_permissions"
    assert manifests["calendar.core"]["role_grants"] == "uok_calendar_core.policy:role_grants"
    assert manifests["calendar.core"]["model_exports"] == "uok_calendar_core.models:owned_models"
    assert manifests["calendar.core"]["candidate_verifier_script"] == "modules/calendar.core/verify/UokCandidateCalendar.ps1"
    assert "/api/calendar" in manifests["calendar.core"]["api_prefixes"]
    assert "CreateCalendarEvent" in manifests["calendar.core"]["commands"]
    assert "calendar.read" in manifests["calendar.core"]["permissions"]
    assert manifests["communications.core"]["api_router"] == "uok_communications_core.api:router"
    assert manifests["communications.core"]["command_handlers"] == "uok_communications_core.commands:command_handlers"
    assert "CreateCommunicationThread" in manifests["communications.core"]["commands"]
    assert "communications.read" in manifests["communications.core"]["permissions"]
    assert manifests["contacts.core"]["required"] is False
    assert "CreateContact" in manifests["contacts.core"]["commands"]
    assert "ContactCreated" in manifests["contacts.core"]["events"]
    assert manifests["contacts.core"]["backend_path"] == "modules/contacts.core/backend"
    assert "/api/contacts" in manifests["contacts.core"]["api_prefixes"]
    assert manifests["contacts.core"]["command_handlers"] == "uok_contacts_core.commands:command_handlers"
    assert manifests["contacts.core"]["command_permissions"] == "uok_contacts_core.commands:command_permissions"
    assert manifests["contacts.core"]["role_grants"] == "uok_contacts_core.policy:role_grants"
    assert manifests["contacts.core"]["dashboard_provider"] == "uok_contacts_core.reports:dashboard_counts"
    assert manifests["contacts.core"]["evidence_provider"] == "uok_contacts_core.reports:evidence"
    assert manifests["contacts.core"]["model_exports"] == "uok_contacts_core.models:owned_models"
    assert manifests["contacts.core"]["candidate_verifier_script"] == "modules/contacts.core/verify/UokCandidateContacts.ps1"
    assert "contacts.manage" in manifests["contacts.core"]["permissions"]
    assert (root / "contacts.core" / "migrations" / "001_contacts_core_operational_indexes.sql").is_file()
    assert manifests["planning.core"]["required"] is False
    assert manifests["planning.core"]["backend_path"] == "modules/planning.core/backend"
    assert manifests["planning.core"]["dependencies"] == ["calendar.core"]
    assert manifests["planning.core"]["api_router"] == "uok_planning_core.api:router"
    assert manifests["planning.core"]["command_handlers"] == "uok_planning_core.commands:command_handlers"
    assert "SetPlanningResourceCalendar" in manifests["planning.core"]["commands"]
    assert "PlanningResourceCalendarUpdated" in manifests["planning.core"]["events"]
    assert manifests["planning.core"]["candidate_verifier_script"] == "modules/planning.core/verify/UokCandidatePlanning.ps1"
    assert "CreatePlanningProject" in manifests["planning.core"]["commands"]
    assert "PlanningTaskLinked" in manifests["planning.core"]["events"]
    assert set(manifests["planning.core"]["permissions"]) == {
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
    assert manifests["reports.core"]["required"] is False
    assert manifests["reports.core"]["kind"] == "capability_module"
    assert "GenerateReport" in manifests["reports.core"]["commands"]
    assert "ReportGenerated" in manifests["reports.core"]["events"]
    assert manifests["reports.core"]["backend_path"] == "modules/reports.core/backend"
    assert "/api/reports" in manifests["reports.core"]["api_prefixes"]
    assert manifests["reports.core"]["api_router"] == "uok_reports_core.api:router"
    assert manifests["reports.core"]["command_handlers"] == "uok_reports_core.commands:command_handlers"
    assert manifests["reports.core"]["command_permissions"] == "uok_reports_core.commands:command_permissions"
    assert manifests["reports.core"]["role_grants"] == "uok_reports_core.policy:role_grants"
    assert manifests["reports.core"]["model_exports"] == "uok_reports_core.models:owned_models"
    assert manifests["reports.core"]["candidate_verifier_script"] == "modules/reports.core/verify/UokCandidateReports.ps1"
    assert "reports.render" in manifests["reports.core"]["permissions"]


def test_contacts_core_backend_loads_from_physical_module_root() -> None:
    ensure_module_backend_paths()

    import uok_contacts_core
    from uok import contacts

    backend_file = Path(uok_contacts_core.__file__).resolve()
    assert "modules" in backend_file.parts
    assert "contacts.core" in backend_file.parts
    assert contacts.clean_text(" UOK ") == "UOK"


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
    assert extension_contract["checks"]["owned_tables_resolve_to_models"] is True
    assert extension_contract["violations"] == []


def test_kernel_imports_module_backends_only_in_declared_facades() -> None:
    package_names = set()
    for backend_dir in module_backend_paths():
        for child in sorted(backend_dir.iterdir()):
            if child.is_dir() and (child / "__init__.py").is_file():
                package_names.add(child.name)
    assert "uok_contacts_core" in package_names
    assert "uok_apps_manager" in package_names
    assert "uok_calendar_core" in package_names
    assert "uok_communications_core" in package_names
    assert "uok_planning_core" in package_names
    assert "uok_reports_core" in package_names

    import_pattern = re.compile(rf"^\s*(?:from|import)\s+(?:{'|'.join(sorted(package_names))})\b", re.MULTILINE)
    offenders = sorted(
        path.relative_to(repo_root()).as_posix()
        for path in (repo_root() / "src" / "uok").rglob("*.py")
        if import_pattern.search(path.read_text(encoding="utf-8"))
        and path.relative_to(repo_root()).as_posix() not in KERNEL_MODULE_FACADE_FILES
    )
    assert offenders == []


def test_module_routers_mount_from_manifest_declarations() -> None:
    manifests = load_module_manifests()
    routers = load_module_routers()

    assert [module_name for module_name, _ in routers] == [
        "apps.manager",
        "calendar.core",
        "communications.core",
        "contacts.core",
        "planning.core",
        "reports.core",
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
    assert "ImportContactsCsv" in handlers
    assert "GenerateReport" in handlers
    assert "DeleteReportArtifact" in handlers
    assert permissions["CreateContact"] == "contacts.manage"
    assert permissions["CreateCalendarEvent"] == "calendar.event.create"
    assert permissions["CreateCommunicationThread"] == "communications.edit"
    assert permissions["CreatePlanningProject"] == "planning.edit"
    assert permissions["CreatePlanningBaseline"] == "planning.baseline.create"
    assert permissions["LevelPlanningResources"] == "planning.level"
    assert permissions["CreatePlanningWhatIfSnapshot"] == "planning.analyze"
    assert permissions["RunPlanningRiskAnalysis"] == "planning.analyze"
    assert permissions["RunPlanningOptimization"] == "planning.analyze"
    assert permissions["DecidePlanningRecommendation"] == "planning.analysis.approve"
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
    assert grants["trader"] >= {"planning.read", "planning.edit"}
    assert "reports.manage" in grants["ops_manager"]
    assert "contacts.read" in grants["viewer"]
    assert "calendar.read" in grants["viewer"]
    assert "reports.read" in grants["viewer"]
    assert {
        "calendars",
        "calendar_events",
        "calendar_event_participants",
        "calendar_reminders",
        "communication_threads",
        "parties",
        "party_notes",
        "party_relationships",
        "contact_import_batches",
        "planning_projects",
        "planning_tasks",
        "planning_task_dependencies",
        "planning_resource_calendars",
        "report_artifacts",
    }.issubset(declared_module_table_names())


def test_app_composes_module_routes_without_kernel_module_references() -> None:
    from uok.main import app

    app_paths = set(app.openapi()["paths"])
    assert "/api/contacts" in app_paths
    assert "/api/calendar/calendars" in app_paths
    assert "/api/contacts/review-queue" in app_paths
    assert "/api/planning/projects" in app_paths
    assert "/api/planning/projects/{project_id}/resources/{resource_id}/calendar" in app_paths
    assert "/api/reports/formats" in app_paths

    main_source = (repo_root() / "src" / "uok" / "main.py").read_text(encoding="utf-8")
    assert "contacts" not in main_source.lower()
