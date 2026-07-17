from __future__ import annotations

import importlib
from dataclasses import is_dataclass
from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.host.module_paths import ensure_module_backend_paths, repo_root
from tests.module_public_api_contract import (
    FRONTEND_EXCLUDED_PARTS,
    FRONTEND_SCAN_ROOTS,
    MODULES,
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


def test_manifests_compose_through_public_facades_and_keep_models_private() -> None:
    manifests = load_module_manifests()
    public_fields = (
        "api_router",
        "command_handlers",
        "command_permissions",
        "role_grants",
        "dashboard_provider",
        "evidence_provider",
    )
    for owner, contract in MODULES.items():
        manifest = manifests[str(contract["folder"])]
        public_module = str(contract["package"]) + ".public_api"
        for field in public_fields:
            if field not in manifest["extension_points"]:
                assert field not in manifest
                continue
            target_module, _, target_symbol = str(manifest[field]).partition(":")
            assert target_module == public_module
            assert target_symbol in contract["symbols"]
        if owner == "planning":
            target_module, _, target_symbol = str(manifest["command_replay_guard"]).partition(":")
            assert target_module == public_module
            assert target_symbol in contract["symbols"]
        assert manifest["model_exports"] == (
            str(contract["package"]) + "._internal.persistence.models:owned_models"
        )


def test_supported_python_surfaces_are_exact_and_boundary_dtos_are_immutable() -> None:
    ensure_module_backend_paths()
    apis = {
        owner: importlib.import_module(f"{contract['package']}.public_api")
        for owner, contract in MODULES.items()
    }
    for owner, api in apis.items():
        assert set(api.__all__) == MODULES[owner]["symbols"]
        assert {name for name in dir(api) if not name.startswith("_")} == MODULES[owner]["symbols"]
        assert all("model" not in name.casefold() for name in api.__all__)

    contacts_api = apis["contacts"]
    assert is_dataclass(contacts_api.PartyReferenceResolution)
    assert contacts_api.PartyReferenceResolution.__dataclass_params__.frozen is True
    compliance_api = apis["compliance"]
    assert is_dataclass(compliance_api.ComplianceDocumentTypeReferenceDTO)
    assert (
        compliance_api.ComplianceDocumentTypeReferenceDTO.__dataclass_params__.frozen
        is True
    )
    locations_api = apis["locations"]
    assert is_dataclass(locations_api.LocationReferenceResolution)
    assert locations_api.LocationReferenceResolution.__dataclass_params__.frozen is True
    routes_api = apis["routes"]
    assert is_dataclass(routes_api.RoutePathReferenceDTO)
    assert routes_api.RoutePathReferenceDTO.__dataclass_params__.frozen is True
    assert is_dataclass(routes_api.RouteReferenceDTO)
    assert routes_api.RouteReferenceDTO.__dataclass_params__.frozen is True
    shipments_api = apis["shipments"]
    assert is_dataclass(shipments_api.ShipmentReferenceDTO)
    assert shipments_api.ShipmentReferenceDTO.__dataclass_params__.frozen is True


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
        assert _python_violations(
            f"from {contract['package']}.public_api import command_handlers",
            path,
        ) == []

    planning_owner = Path("modules/planning.core/tests/example.py")
    assert _python_violations("from uok.models import PlanningTask", planning_owner)
    assert _python_violations("from uok.models import Party", planning_owner)


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
    for folder, private_symbol in (
        ("product.master", "ProductMasterWorkspace"),
        ("compliance.core", "ComplianceDocumentTypeWorkspace"),
        ("locations.core", "LocationMasterWorkspace"),
        ("routes.core", "RouteMasterWorkspace"),
        ("shipments.core", "ShipmentSupportWorkspace"),
    ):
        assert _frontend_violations(
            f'import {{ {private_symbol} }} from "@uok-modules/{folder}/web/src/{private_symbol}";',
            path,
        )
        assert _frontend_violations(
            f'import surface from "@uok-modules/{folder}/web/src/moduleSurface";',
            path,
        ) == []
