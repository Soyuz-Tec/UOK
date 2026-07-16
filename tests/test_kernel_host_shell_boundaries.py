from __future__ import annotations

import re
from pathlib import Path

from tests.kernel_host_shell_boundary_support import (
    frontend_owner,
    production_typescript_files,
    resolve_typescript_target,
    strongly_connected_components,
    typescript_graph,
    typescript_specifiers,
)


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = (
    ROOT / "web" / "src" / "generated" / "moduleSurfaceCatalog.ts"
).resolve()
OPENAPI_CONTRACT = (
    ROOT / "web" / "src" / "generated" / "openapi.d.ts"
).resolve()
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
                    f"{path.relative_to(ROOT).as_posix()}:{reference.line} "
                    f"imports shell {reference.target}"
                )
                continue
            target = resolve_typescript_target(path, reference.target, ROOT, files)
            if target is None or not target.is_relative_to(web_root):
                continue
            relative = target.relative_to(web_root)
            if relative.parts[0] in {"contracts", "shared"} or target == OPENAPI_CONTRACT:
                continue
            violations.append(
                f"{path.relative_to(ROOT).as_posix()}:{reference.line} "
                f"imports shell {reference.target}"
            )
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
                        f"{path.relative_to(ROOT).as_posix()}:{reference.line} "
                        f"imports module {reference.target}"
                    )
                continue
            if frontend_owner(target, ROOT) == "shell":
                continue
            expected = target.parent.name == "src" and target.stem == "moduleSurface"
            if path != CATALOG_PATH or not expected:
                violations.append(
                    f"{path.relative_to(ROOT).as_posix()}:{reference.line} "
                    f"imports module {reference.target}"
                )
    assert violations == []


def test_frontend_graph_has_no_shell_module_cycle() -> None:
    graph = typescript_graph(ROOT)
    mixed = []
    for component in strongly_connected_components(graph):
        owners = {frontend_owner(path, ROOT) for path in component}
        if "shell" in owners and any(owner.startswith("module:") for owner in owners):
            mixed.append(
                f"owners={sorted(owners)} files="
                + ", ".join(
                    path.relative_to(ROOT).as_posix()
                    for path in sorted(component)[:20]
                )
            )
    assert mixed == []


def test_shell_has_no_contacts_domain_orchestration() -> None:
    violations: list[str] = []
    for base in (ROOT / "web" / "src" / "app", ROOT / "web" / "src" / "shared"):
        for path in sorted(base.rglob("*")):
            if (
                path.suffix not in {".ts", ".tsx"}
                or ".test." in path.name
                or ".spec." in path.name
            ):
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
                violations.append(
                    f"{path.relative_to(ROOT).as_posix()}: {', '.join(reasons)}"
                )
    assert violations == []


def test_typescript_scanner_resolves_import_variants(tmp_path: Path) -> None:
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
