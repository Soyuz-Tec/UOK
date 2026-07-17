from __future__ import annotations

import ast
import importlib
import re
from dataclasses import is_dataclass
from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.host.module_paths import ensure_module_backend_paths, repo_root
from tests.module_public_api_contract import (
    FRONTEND_EXCLUDED_PARTS,
    FRONTEND_SCAN_ROOTS,
    FRONTEND_SPECIFIER_PATTERN,
    MODULES,
    PYTHON_SCAN_ROOTS,
)


def _owner(relative_path: Path) -> str | None:
    if len(relative_path.parts) >= 2 and relative_path.parts[0] == "modules":
        for owner, contract in MODULES.items():
            if relative_path.parts[1] == contract["folder"]:
                return owner
    return None


def _python_violations(source: str, relative_path: Path) -> list[str]:
    tree = ast.parse(source, filename=relative_path.as_posix())
    owner = _owner(relative_path)
    violations: list[str] = []

    def validate_kernel_model_access(target: str, names: list[str] | None, line: int) -> bool:
        if target == "uok" and names is not None and "models" in names:
            violations.append(
                f"{relative_path.as_posix()}:{line} imports retired module-owned ORM facade uok.models"
            )
            return True
        if target != "uok.models":
            return False
        violations.append(
            f"{relative_path.as_posix()}:{line} imports retired module-owned ORM facade uok.models"
        )
        return True

    def validate(target: str, names: list[str] | None, line: int) -> None:
        if validate_kernel_model_access(target, names, line):
            return
        for module_owner, contract in MODULES.items():
            package = str(contract["package"])
            if target != package and not target.startswith(package + "."):
                continue
            if owner == module_owner:
                return
            public_module = package + ".public_api"
            if target != public_module:
                violations.append(f"{relative_path.as_posix()}:{line} imports private {target}")
                return
            if names is None:
                violations.append(
                    f"{relative_path.as_posix()}:{line} imports facade module object {public_module}; "
                    "use named supported symbols"
                )
                return
            allowed = set(contract["symbols"])
            forbidden = sorted(name for name in names if name == "*" or name not in allowed)
            if forbidden:
                violations.append(
                    f"{relative_path.as_posix()}:{line} imports unsupported {public_module} symbols {forbidden}"
                )
            return

    import_module_names = {"__import__"}
    importlib_module_names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "importlib" or alias.name.startswith("importlib."):
                    importlib_module_names.add(alias.asname or "importlib")
        elif isinstance(node, ast.ImportFrom) and node.module == "importlib":
            for alias in node.names:
                if alias.name == "import_module":
                    import_module_names.add(alias.asname or alias.name)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                validate(alias.name, None, node.lineno)
        elif isinstance(node, ast.ImportFrom) and node.module:
            validate(node.module, [alias.name for alias in node.names], node.lineno)
        elif isinstance(node, ast.Call) and node.args:
            is_dynamic_import = False
            if isinstance(node.func, ast.Name):
                is_dynamic_import = node.func.id in import_module_names
            elif isinstance(node.func, ast.Attribute):
                is_dynamic_import = (
                    node.func.attr == "import_module"
                    and isinstance(node.func.value, ast.Name)
                    and node.func.value.id in importlib_module_names
                )
            if is_dynamic_import:
                target = node.args[0]
                if isinstance(target, ast.Constant) and isinstance(target.value, str):
                    validate(target.value, None, node.lineno)
    return violations


def _frontend_violations(source: str, relative_path: Path) -> list[str]:
    owner = _owner(relative_path)
    violations = []
    root = repo_root()
    module_folders = "|".join(re.escape(str(contract["folder"])) for contract in MODULES.values())
    for match in FRONTEND_SPECIFIER_PATTERN.finditer(source):
        target = match.group(1)
        module_owner: str | None = None
        suffix = ""
        alias_match = re.fullmatch(rf"@uok-modules/({module_folders})/web/src/(.+)", target)
        if alias_match:
            module_folder, suffix = alias_match.groups()
            module_owner = next(
                candidate_owner
                for candidate_owner, contract in MODULES.items()
                if contract["folder"] == module_folder
            )
        elif target.startswith("."):
            resolved = (root / relative_path.parent / target).resolve()
            for candidate_owner, contract in MODULES.items():
                module_source = (
                    root / "modules" / str(contract["folder"]) / "web" / "src"
                ).resolve()
                if resolved == module_source or resolved.is_relative_to(module_source):
                    module_owner = candidate_owner
                    suffix = resolved.relative_to(module_source).as_posix()
                    break
        if module_owner is None:
            continue
        if owner == module_owner:
            continue
        if suffix not in {"moduleSurface", "moduleSurface.tsx"}:
            line = source.count("\n", 0, match.start()) + 1
            violations.append(f"{relative_path.as_posix()}:{line} imports private {target}")
    return violations


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


def test_supported_python_surfaces_are_exact_and_contacts_dto_is_immutable() -> None:
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
        ("locations.core", "LocationMasterWorkspace"),
    ):
        assert _frontend_violations(
            f'import {{ {private_symbol} }} from "@uok-modules/{folder}/web/src/{private_symbol}";',
            path,
        )
        assert _frontend_violations(
            f'import surface from "@uok-modules/{folder}/web/src/moduleSurface";',
            path,
        ) == []
