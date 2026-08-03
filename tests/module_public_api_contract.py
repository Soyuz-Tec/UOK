from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from uok.host.module_paths import repo_root
from uok.module_manifest_loader import load_module_manifests


PUBLIC_API_SYMBOLS = {
    "calendar.core": {
        "CalendarEventReferenceResolution",
        "freebusy_rows_for_participants",
        "occurrence_rows_for_participants",
        "resolve_calendar_event_reference",
    },
    "communications.core": {
        "CommunicationThreadReferenceResolution",
        "resolve_communication_thread_reference",
    },
    "planning.core": {
        "api_router",
        "assert_planning_replay_visible",
        "command_handlers",
        "command_permissions",
        "dashboard_counts",
        "evidence",
        "role_grants",
    },
    "contacts.core": {
        "PartyReferenceResolution",
        "api_router",
        "command_handlers",
        "command_permissions",
        "dashboard_counts",
        "evidence",
        "resolve_party_reference",
        "role_grants",
    },
    "compliance.core": {
        "ComplianceDocumentTypeReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_compliance_document_type_references",
        "role_grants",
    },
    "product.master": {
        "api_router",
        "command_handlers",
        "command_permissions",
        "role_grants",
    },
    "locations.core": {
        "LocationReferenceResolution",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_location_references",
        "role_grants",
    },
    "reports.core": {
        "ReportArtifactReferenceResolution",
        "resolve_report_artifact_reference",
    },
    "routes.core": {
        "RoutePathReferenceDTO",
        "RouteReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_route_path_references",
        "resolve_route_reference",
        "role_grants",
    },
    "shipments.core": {
        "ShipmentReadinessSnapshotDTO",
        "ShipmentReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_shipment_readiness_snapshots",
        "resolve_shipment_reference",
        "role_grants",
    },
    "intelligence.core": {
        "api_router",
        "role_grants",
    },
}

PYTHON_EXTENSION_FIELDS = (
    "api_router",
    "command_handlers",
    "command_permissions",
    "command_replay_guard",
    "role_grants",
    "dashboard_provider",
    "evidence_provider",
    "model_exports",
)
PYTHON_SCAN_ROOTS = ("src", "scripts", "modules", "tests")
PRIVILEGED_PYTHON_IMPORT_PATHS = {
    Path("tests/test_module_model_registry.py"),
}
FRONTEND_PUBLIC_IMPORTS = {
    "reports.core": frozenset({"serverReports", "serverReports.ts"}),
}
FRONTEND_SCAN_ROOTS = ("web", "modules")
FRONTEND_EXCLUDED_PARTS = {"node_modules", "dist", "coverage"}
FRONTEND_SPECIFIER_PATTERN = re.compile(
    r"(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)[\"']([^\"']+)[\"']"
)


def _backend_package(module_name: str, manifest: dict[str, Any]) -> str:
    backend_root = repo_root() / str(manifest["backend_path"])
    candidates = sorted(
        path.name
        for path in backend_root.iterdir()
        if path.is_dir() and (path / "__init__.py").is_file()
    )
    if len(candidates) != 1:
        raise AssertionError(
            f"{module_name} must own exactly one importable backend package; "
            f"found {candidates}"
        )
    return candidates[0]


def _active_module_contracts() -> dict[str, dict[str, object]]:
    contracts: dict[str, dict[str, object]] = {}
    for module_name, manifest in load_module_manifests().items():
        if manifest["maturity"] == "planned":
            continue
        package = _backend_package(module_name, manifest)
        contracts[module_name] = {
            "folder": module_name,
            "package": package,
            "public_module": (
                f"{package}.public_api"
                if module_name in PUBLIC_API_SYMBOLS
                else None
            ),
            "symbols": frozenset(PUBLIC_API_SYMBOLS.get(module_name, set())),
        }
    return contracts


MODULES = _active_module_contracts()
FRONTEND_MODULES = {
    module_name: contract
    for module_name, contract in MODULES.items()
    if (
        repo_root()
        / str(load_module_manifests()[module_name]["web_path"])
        / "src"
    ).is_dir()
}
FRONTEND_ALLOWED_IMPORTS = {
    module_name: frozenset(
        FRONTEND_PUBLIC_IMPORTS.get(module_name, frozenset())
        | (
            {"moduleSurface", "moduleSurface.tsx"}
            if "web_surface"
            in load_module_manifests()[module_name]["extension_points"]
            else set()
        )
    )
    for module_name in FRONTEND_MODULES
}


def _owned_orm_symbols() -> dict[str, set[str]]:
    manifests = load_module_manifests()
    return {
        owner: {
            str(entry)
            for entry in manifests[str(contract["folder"])]["owned_tables"]
            if ":" not in str(entry)
        }
        for owner, contract in MODULES.items()
    }


OWNED_ORM_SYMBOLS = _owned_orm_symbols()

__all__ = [
    "FRONTEND_ALLOWED_IMPORTS",
    "FRONTEND_EXCLUDED_PARTS",
    "FRONTEND_MODULES",
    "FRONTEND_PUBLIC_IMPORTS",
    "FRONTEND_SCAN_ROOTS",
    "FRONTEND_SPECIFIER_PATTERN",
    "MODULES",
    "OWNED_ORM_SYMBOLS",
    "PRIVILEGED_PYTHON_IMPORT_PATHS",
    "PUBLIC_API_SYMBOLS",
    "PYTHON_EXTENSION_FIELDS",
    "PYTHON_SCAN_ROOTS",
]
