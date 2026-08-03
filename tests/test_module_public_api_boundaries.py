from __future__ import annotations

import importlib
from dataclasses import is_dataclass
from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.host.module_paths import ensure_module_backend_paths, repo_root
from tests.module_public_api_contract import (
    FRONTEND_ALLOWED_IMPORTS,
    FRONTEND_EXCLUDED_PARTS,
    FRONTEND_MODULES,
    FRONTEND_SCAN_ROOTS,
    MODULES,
    PUBLIC_API_SYMBOLS,
    PYTHON_EXTENSION_FIELDS,
    PYTHON_SCAN_ROOTS,
)
from tests.module_public_api_rules import (
    frontend_violations as _frontend_violations,
    python_violations as _python_violations,
)


def test_external_python_callers_use_only_supported_public_facades() -> None:
    root = repo_root()
    violations: list[str] = []
    for scan_root in PYTHON_SCAN_ROOTS:
        for path in sorted((root / scan_root).rglob("*.py")):
            relative = path.relative_to(root)
            violations.extend(_python_violations(path.read_text(encoding="utf-8"), relative))
    assert violations == []


def test_external_frontend_callers_use_only_module_surfaces() -> None:
    root = repo_root()
    violations: list[str] = []
    seen: set[Path] = set()
    for scan_root in FRONTEND_SCAN_ROOTS:
        for extension in ("*.ts", "*.tsx"):
            for path in sorted((root / scan_root).rglob(extension)):
                if path in seen:
                    continue
                seen.add(path)
                relative = path.relative_to(root)
                if any(part in FRONTEND_EXCLUDED_PARTS for part in relative.parts):
                    continue
                violations.extend(_frontend_violations(path.read_text(encoding="utf-8"), relative))
    assert violations == []


def test_all_active_manifest_backends_are_covered_by_the_boundary_contract() -> None:
    root = repo_root()
    manifests = load_module_manifests()
    active_modules = {
        module_name
        for module_name, manifest in manifests.items()
        if manifest["maturity"] != "planned"
    }
    assert set(MODULES) == active_modules
    assert set(PUBLIC_API_SYMBOLS) <= active_modules
    assert set(FRONTEND_MODULES) == {
        module_name
        for module_name in active_modules
        if (
            root
            / str(manifests[module_name]["web_path"])
            / "src"
        ).is_dir()
    }

    for module_name, contract in MODULES.items():
        manifest = manifests[module_name]
        package = str(contract["package"])
        backend_root = root / str(manifest["backend_path"])
        assert (backend_root / package / "__init__.py").is_file()
        public_api_exists = (backend_root / package / "public_api.py").is_file()
        assert public_api_exists is (module_name in PUBLIC_API_SYMBOLS)
        for field in PYTHON_EXTENSION_FIELDS:
            if field not in manifest:
                continue
            target_module, separator, target_symbol = str(manifest[field]).partition(":")
            assert separator == ":"
            assert target_symbol
            assert target_module.split(".", 1)[0] == package


def test_manifests_keep_extension_imports_inside_owner_packages_and_models_private() -> None:
    manifests = load_module_manifests()
    for module_name, contract in MODULES.items():
        manifest = manifests[module_name]
        package = str(contract["package"])
        public_module = contract["public_module"]
        compose_through_public_api = False
        if "api_router" in manifest["extension_points"]:
            api_module, separator, api_symbol = str(manifest["api_router"]).partition(":")
            assert separator == ":"
            assert api_module.split(".", 1)[0] == package
            assert api_symbol
            compose_through_public_api = api_module == public_module
        for field in PYTHON_EXTENSION_FIELDS:
            if field not in manifest["extension_points"]:
                assert field not in manifest
                continue
            target_module, _, target_symbol = str(manifest[field]).partition(":")
            assert target_module.split(".", 1)[0] == package
            if target_module == public_module:
                assert target_symbol in contract["symbols"]
            if field == "model_exports":
                assert target_symbol == "owned_models"
                assert target_module != public_module
            elif compose_through_public_api:
                assert target_module == public_module
                assert target_symbol in contract["symbols"]


def test_supported_python_surfaces_are_exact_and_boundary_dtos_are_immutable() -> None:
    ensure_module_backend_paths()
    manifests = load_module_manifests()
    apis = {
        module_name: importlib.import_module(str(contract["public_module"]))
        for module_name, contract in MODULES.items()
        if contract["public_module"] is not None
    }
    for module_name, api in apis.items():
        assert set(api.__all__) == MODULES[module_name]["symbols"]
        api_module, _, _ = str(manifests[module_name]["api_router"]).partition(":")
        if api_module == MODULES[module_name]["public_module"]:
            assert {
                name for name in dir(api) if not name.startswith("_")
            } == MODULES[module_name]["symbols"]
        else:
            assert set(MODULES[module_name]["symbols"]) <= set(dir(api))
        assert all("model" not in name.casefold() for name in api.__all__)

    calendar_api = apis["calendar.core"]
    assert is_dataclass(calendar_api.CalendarEventReferenceResolution)
    assert (
        calendar_api.CalendarEventReferenceResolution.__dataclass_params__.frozen
        is True
    )
    communications_api = apis["communications.core"]
    assert is_dataclass(communications_api.CommunicationThreadReferenceResolution)
    assert (
        communications_api.CommunicationThreadReferenceResolution
        .__dataclass_params__.frozen
        is True
    )
    contacts_api = apis["contacts.core"]
    assert is_dataclass(contacts_api.PartyReferenceResolution)
    assert contacts_api.PartyReferenceResolution.__dataclass_params__.frozen is True
    compliance_api = apis["compliance.core"]
    assert is_dataclass(compliance_api.ComplianceDocumentTypeReferenceDTO)
    assert (
        compliance_api.ComplianceDocumentTypeReferenceDTO.__dataclass_params__.frozen
        is True
    )
    locations_api = apis["locations.core"]
    assert is_dataclass(locations_api.LocationReferenceResolution)
    assert locations_api.LocationReferenceResolution.__dataclass_params__.frozen is True
    reports_api = apis["reports.core"]
    assert is_dataclass(reports_api.ReportArtifactReferenceResolution)
    assert (
        reports_api.ReportArtifactReferenceResolution.__dataclass_params__.frozen
        is True
    )
    routes_api = apis["routes.core"]
    assert is_dataclass(routes_api.RoutePathReferenceDTO)
    assert routes_api.RoutePathReferenceDTO.__dataclass_params__.frozen is True
    assert is_dataclass(routes_api.RouteReferenceDTO)
    assert routes_api.RouteReferenceDTO.__dataclass_params__.frozen is True
    shipments_api = apis["shipments.core"]
    assert is_dataclass(shipments_api.ShipmentReferenceDTO)
    assert shipments_api.ShipmentReferenceDTO.__dataclass_params__.frozen is True
    assert is_dataclass(shipments_api.ShipmentReadinessSnapshotDTO)
    assert (
        shipments_api.ShipmentReadinessSnapshotDTO.__dataclass_params__.frozen
        is True
    )


def test_python_rule_rejects_private_root_deep_star_and_unknown_public_imports() -> None:
    path = Path("scripts/example.py")
    forbidden = [
        "import uok_planning_core",
        "from uok_planning_core._internal.scheduling import scheduler",
        "from importlib import import_module as load\nload('uok_contacts_core._internal.persistence.models')",
        "import importlib as loader\nloader.import_module('uok_contacts_core._internal.persistence.models')",
        "import importlib.util\nimportlib.import_module('uok_contacts_core._internal.persistence.models')",
        "from uok.models import Party",
        "from uok.models import PlanningTask",
        "import uok.models as models",
        "from uok import models",
    ]
    for contract in MODULES.values():
        package = str(contract["package"])
        forbidden.extend((
            f"import {package}",
            f"from {package} import public_api",
            f"from {package}.public_api import *",
            f"from {package}.public_api import UnsupportedModel",
            f"import {package}.public_api as module_api",
            f"from importlib import import_module\nimport_module('{package}._internal.persistence.models')",
        ))
    for source in forbidden:
        assert _python_violations(source, path), source

    for contract in MODULES.values():
        symbols = sorted(contract["symbols"])
        if symbols:
            assert _python_violations(
                f"from {contract['public_module']} import {symbols[0]}",
                path,
            ) == []
        else:
            assert _python_violations(
                f"from {contract['package']}.public_api import api_router",
                path,
            )

    planning_owner = Path("modules/planning.core/tests/example.py")
    assert _python_violations("from uok.models import PlanningTask", planning_owner)
    assert _python_violations("from uok.models import Party", planning_owner)
    assert _python_violations(
        "import uok_calendar_core.public_api as calendar_public_api",
        planning_owner,
    ) == []
    assert _python_violations(
        "import uok_calendar_core.models as calendar_models",
        planning_owner,
    )


def test_frontend_rule_rejects_deep_imports_and_accepts_module_surface() -> None:
    path = Path("web/src/app/example.ts")
    assert _frontend_violations(
        'import { useContactCommands } from "@uok-modules/contacts.core/web/src/app/useContactCommands";',
        path,
    )
    assert _frontend_violations(
        'import surface from "@uok-modules/contacts.core/web/src/moduleSurface";',
        path,
    ) == []
    assert _frontend_violations(
        'import "@uok-modules/contacts.core/web/src/app/useContactCommands";',
        path,
    )
    assert _frontend_violations(
        'const commands = import("../../../modules/contacts.core/web/src/app/useContactCommands");',
        path,
    )

    generated_path = Path("web/src/generated/moduleSurfaceCatalog.ts")
    assert _frontend_violations(
        'import surface from "../../../modules/contacts.core/web/src/moduleSurface";',
        generated_path,
    ) == []
    for contract in FRONTEND_MODULES.values():
        folder = str(contract["folder"])
        assert _frontend_violations(
            f'import privateSurface from "@uok-modules/{folder}/web/src/privateSurface";',
            path,
        )
        for public_path in FRONTEND_ALLOWED_IMPORTS[folder]:
            assert _frontend_violations(
                f'import publicApi from "@uok-modules/{folder}/web/src/{public_path}";',
                path,
            ) == []

    assert _frontend_violations(
        'import { generateReportArtifacts } from "@uok-modules/reports.core/web/src/serverReports";',
        path,
    ) == []
    assert _frontend_violations(
        'import privateApi from "@uok-modules/reports.core/web/src/serverReports/internal";',
        path,
    )
    assert _frontend_violations(
        'import surface from "@uok-modules/reports.core/web/src/moduleSurface";',
        path,
    )
