from __future__ import annotations

import re
from pathlib import Path

from tests.kernel_host_shell_boundary_support import (
    feature_module_runtime_import_allowed,
    feature_backend_packages,
    frontend_owner,
    import_candidates,
    production_typescript_files,
    python_imports,
    python_module_name,
    resolve_typescript_target,
    strongly_connected_components,
    typescript_graph,
    typescript_specifiers,
)


ROOT = Path(__file__).resolve().parents[1]
KERNEL_ROOT = ROOT / "src" / "uok" / "kernel"
CATALOG_PATH = (ROOT / "web" / "src" / "generated" / "moduleSurfaceCatalog.ts").resolve()
OPENAPI_CONTRACT = (ROOT / "web" / "src" / "generated" / "openapi.d.ts").resolve()
LEGACY_COMPOSITION_MODULES = {
    "uok.calendar_models",
    "uok.communication_models",
    "uok.db",
    "uok.db_pool",
    "uok.main",
    "uok.models",
    "uok.module_commands",
    "uok.module_dependencies",
    "uok.module_imports",
    "uok.module_model_registry",
    "uok.module_ops",
    "uok.module_paths",
    "uok.module_policy",
    "uok.module_reports",
    "uok.module_routers",
    "uok.modules",
}
CONTACT_COMMANDS = {
    "AddContactNote",
    "AddContactsToGroup",
    "ArchiveContact",
    "CreateContact",
    "LinkContactRelationship",
    "MergeDuplicateContact",
    "PurgeContact",
    "RemoveContactFromGroup",
    "RemoveContactRelationship",
    "RestoreContact",
    "UpdateContact",
    "UpdateContactRelationship",
}
CONTACT_DTO_PATTERN = re.compile(
    r"\bContact(?:Attrs|BusinessIntelligenceProfile|DetailPane|Draft|GroupBy|"
    r"GroupMembership|GroupRecord|MergeField(?:Choices)?|QualityFilter|Record|"
    r"SortBy|SortDir|SourceFilter)\b"
)
CONTACT_PREFERENCE_PATTERN = re.compile(
    r"\b(?:contactDetailPane|contactGroupBy|contactsGroupByKey|contactsView|"
    r"contactsViewKey|contactsViewOptions|contactDetailPaneOptions)\b"
)


def _matches_prefix(target: str, prefixes: set[str]) -> bool:
    return any(target == prefix or target.startswith(prefix + ".") for prefix in prefixes)


def _is_http_adapter(path: Path) -> bool:
    stem = path.stem
    return stem == "api" or stem == "api_support" or stem.startswith("api_") or stem.endswith("_api")


def _kernel_violations(path: Path, feature_packages: set[str]) -> list[str]:
    source = path.read_text(encoding="utf-8")
    references = python_imports(source, python_module_name(path, ROOT))
    forbidden = {"fastapi", "starlette", "uok.host", *feature_packages}
    return [
        f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports {target}"
        for reference in references
        for target in sorted(import_candidates(reference))
        if _matches_prefix(target, forbidden)
    ]


def _feature_backend_violations(path: Path) -> list[str]:
    package = next(
        child.name
        for child in path.parents
        if child.parent.name == "backend" and (child / "__init__.py").is_file()
    )
    references = python_imports(path.read_text(encoding="utf-8"), f"{package}.{path.stem}")
    violations: list[str] = []
    for reference in references:
        runtime_candidates = import_candidates(reference)
        if any(_matches_prefix(target, {"uok.kernel.module_runtime"}) for target in runtime_candidates):
            if not feature_module_runtime_import_allowed(reference):
                violations.append(
                    f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports host-only module runtime configuration"
                )
            continue
        if reference.target == "uok.host.database":
            allowed = (
                not reference.dynamic
                and reference.names == ("get_db",)
                and reference.aliases == (None,)
                and _is_http_adapter(path)
            )
            if not allowed:
                violations.append(f"{path.relative_to(ROOT).as_posix()}:{reference.line} uses invalid host database import")
            continue
        candidates = import_candidates(reference)
        if any(_matches_prefix(target, {"uok.host", *LEGACY_COMPOSITION_MODULES}) for target in candidates):
            violations.append(f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports host/composition {reference.target}")
        if reference.target.startswith("uok") and reference.names and {"engine", "SessionLocal"}.intersection(reference.names):
            violations.append(f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports engine/session factory")
    return violations


def test_kernel_is_framework_and_feature_independent() -> None:
    assert KERNEL_ROOT.is_dir()
    packages = feature_backend_packages(ROOT)
    violations = [
        violation
        for path in sorted(KERNEL_ROOT.rglob("*.py"))
        for violation in _kernel_violations(path, packages)
    ]
    assert violations == []


def test_feature_backends_do_not_import_host_composition() -> None:
    violations = [
        violation
        for path in sorted((ROOT / "modules").glob("*/backend/**/*.py"))
        for violation in _feature_backend_violations(path)
    ]
    assert violations == []


def test_feature_frontends_use_only_neutral_shell_contracts() -> None:
    files = production_typescript_files(ROOT)
    web_root = (ROOT / "web" / "src").resolve()
    violations: list[str] = []
    for path in sorted(files):
        if frontend_owner(path, ROOT) == "shell":
            continue
        source = path.read_text(encoding="utf-8")
        for reference in typescript_specifiers(source):
            if reference.target.startswith("@uok/") and not (
                reference.target.startswith(("@uok/contracts/", "@uok/shared/"))
                or reference.target == "@uok/generated/openapi"
            ):
                violations.append(
                    f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports shell {reference.target}"
                )
                continue
            target = resolve_typescript_target(path, reference.target, ROOT, files)
            if target is None or not target.is_relative_to(web_root):
                continue
            relative = target.relative_to(web_root)
            if relative.parts[0] in {"contracts", "shared"} or target == OPENAPI_CONTRACT:
                continue
            violations.append(f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports shell {reference.target}")
    assert violations == []


def test_shell_imports_only_exact_generated_module_surfaces() -> None:
    files = production_typescript_files(ROOT)
    violations: list[str] = []
    for path in sorted(files):
        if frontend_owner(path, ROOT) != "shell":
            continue
        for reference in typescript_specifiers(path.read_text(encoding="utf-8")):
            target = resolve_typescript_target(path, reference.target, ROOT, files)
            if target is None:
                if reference.target.startswith("@uok-modules/"):
                    violations.append(
                        f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports module {reference.target}"
                    )
                continue
            if frontend_owner(target, ROOT) == "shell":
                continue
            expected = target.parent.name == "src" and target.stem == "moduleSurface"
            if path != CATALOG_PATH or not expected:
                violations.append(f"{path.relative_to(ROOT).as_posix()}:{reference.line} imports module {reference.target}")
    assert violations == []


def test_frontend_graph_has_no_shell_module_cycle() -> None:
    graph = typescript_graph(ROOT)
    mixed = []
    for component in strongly_connected_components(graph):
        owners = {frontend_owner(path, ROOT) for path in component}
        if "shell" in owners and any(owner.startswith("module:") for owner in owners):
            mixed.append(
                f"owners={sorted(owners)} files="
                + ", ".join(path.relative_to(ROOT).as_posix() for path in sorted(component)[:20])
            )
    assert mixed == []


def test_shell_has_no_contacts_domain_orchestration() -> None:
    violations: list[str] = []
    for base in (ROOT / "web" / "src" / "app", ROOT / "web" / "src" / "shared"):
        for path in sorted(base.rglob("*")):
            if path.suffix not in {".ts", ".tsx"} or ".test." in path.name or ".spec." in path.name:
                continue
            source = path.read_text(encoding="utf-8")
            reasons = []
            if "/api/contacts" in source:
                reasons.append("Contacts API path")
            if CONTACT_COMMANDS.intersection(re.findall(r"[A-Z][A-Za-z]+", source)):
                reasons.append("Contacts command")
            if CONTACT_DTO_PATTERN.search(source):
                reasons.append("Contacts DTO")
            if CONTACT_PREFERENCE_PATTERN.search(source) or "uok_contacts_" in source:
                reasons.append("Contacts preference/storage declaration")
            if reasons:
                violations.append(f"{path.relative_to(ROOT).as_posix()}: {', '.join(reasons)}")
    assert violations == []


def test_python_scanner_rejects_relative_alias_and_dynamic_bypasses() -> None:
    source = (
        "from .. import host\n"
        "import importlib as loader\n"
        "loader.import_module('uok_contacts_core.public_api')\n"
    )
    candidates = {
        candidate
        for reference in python_imports(source, "uok.kernel.example")
        for candidate in import_candidates(reference)
    }
    assert {"uok.host", "uok_contacts_core.public_api"}.issubset(candidates)


def test_feature_module_runtime_imports_are_named_and_host_configuration_is_private() -> None:
    allowed = python_imports(
        "from uok.kernel.module_runtime import module_catalog, ensure_module_operational",
        "feature.api",
    )[0]
    forbidden = [
        python_imports(source, "feature.api")[0]
        for source in (
            "import uok.kernel.module_runtime",
            "from uok.kernel.module_runtime import *",
            "from uok.kernel.module_runtime import ModuleRuntimePort",
            "from uok.kernel.module_runtime import configure_module_runtime",
        )
    ]
    assert feature_module_runtime_import_allowed(allowed)
    assert not any(feature_module_runtime_import_allowed(reference) for reference in forbidden)


def test_typescript_scanner_resolves_alias_relative_type_export_and_dynamic_bypasses(
    tmp_path: Path,
) -> None:
    source_path = tmp_path / "web" / "src" / "app" / "example.ts"
    targets = [
        tmp_path / "web" / "src" / "contracts" / "port.ts",
        tmp_path / "web" / "src" / "private.ts",
        tmp_path / "modules" / "contacts.core" / "web" / "src" / "private.ts",
    ]
    for target in targets:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("export const value = 1;\n", encoding="utf-8")
    source = (
        'import type { Port } from "@uok/contracts/port";\n'
        'export { value } from "../private";\n'
        'const feature = import("@uok-modules/contacts.core/web/src/private");\n'
        'const host = require("@uok/app/useWorkbench");\n'
    )
    references = typescript_specifiers(source)
    assert {reference.target for reference in references} == {
        "@uok/contracts/port",
        "../private",
        "@uok-modules/contacts.core/web/src/private",
        "@uok/app/useWorkbench",
    }
    files = {target.resolve() for target in targets}
    resolved = {
        resolve_typescript_target(source_path, reference.target, tmp_path, files)
        for reference in references
    }
    assert set(target.resolve() for target in targets).issubset(resolved)
