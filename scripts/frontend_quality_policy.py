from __future__ import annotations

import json
import stat
import sys
from pathlib import Path
from typing import Any

from frontend_source_policy import is_durable_javascript


_FRONTEND_TOOLING_ARTIFACTS = (
    "eslint.config.mjs",
    "web/eslint.config.mjs",
    "web/stylelint.config.mjs",
    "web/scripts/run-eslint.mjs",
    "web/scripts/check-bundle-budget.mjs",
    "web/scripts/check-dependency-policy.mjs",
)

_FRONTEND_TOOLING_SCRIPTS = {
    "lint": "node scripts/run-eslint.mjs",
    "lint:styles": 'stylelint "src/**/*.css" "../modules/*/web/src/**/*.css"',
    "check:bundle-budget": "node scripts/check-bundle-budget.mjs",
    "check:dependencies": "node scripts/check-dependency-policy.mjs",
}

_FRONTEND_CI_COMMANDS = (
    "npm run check:dependencies",
    "npm run lint",
    "npm run lint:styles",
    "npm run check:bundle-budget",
)


def frontend_stack_problems(repo_root: Path) -> list[str]:
    package = _read_json(repo_root / "web" / "package.json")
    tsconfig = _read_json(repo_root / "web" / "tsconfig.json")
    compiler_options = tsconfig.get("compilerOptions", {})
    problems: list[str] = []
    if package.get("type") != "module":
        problems.append("web/package.json must use type=module")
    if package.get("engines", {}).get("node") != ">=26 <27":
        problems.append("Node engine must be >=26 <27")
    for script in ("test", "build:static", "test:ui-proof"):
        if package.get("scripts", {}).get(script) is None:
            problems.append(f"frontend {script} script missing")
    if package.get("scripts", {}).get("check:contracts") != "python ../scripts/check_generated_contracts.py":
        problems.append("frontend generated-contract drift script missing")
    if package.get("scripts", {}).get("generate:modules") != "python ../scripts/generate_frontend_module_catalog.py":
        problems.append("frontend module-catalog generator script missing")
    if compiler_options.get("strict") is not True:
        problems.append("TypeScript strict mode must stay enabled")
    if compiler_options.get("allowJs") is not False:
        problems.append("TypeScript allowJs must stay false")
    for relative, reason in (
        ("web/package-lock.json", "web/package-lock.json missing"),
        ("web/playwright.config.ts", "Playwright UI proof config missing"),
        ("web/vite.config.ts", "Vite module-boundary config missing"),
    ):
        if not (repo_root / relative).exists():
            problems.append(reason)
    include = set(tsconfig.get("include", []))
    for expected in ("../modules/*/web/src", "../modules/*/tests/web"):
        if expected not in include:
            problems.append(f"TypeScript module ownership root missing: {expected}")
    problems.extend(_frontend_tooling_problems(repo_root, package))
    problems.extend(_durable_javascript_problems(repo_root))
    return problems


def _frontend_tooling_problems(
    repo_root: Path, package: dict[str, Any]
) -> list[str]:
    problems = [
        f"frontend tooling artifact missing: {relative}"
        for relative in _FRONTEND_TOOLING_ARTIFACTS
        if not (repo_root / relative).is_file()
    ]
    package_scripts = package.get("scripts", {})
    for name, expected in _FRONTEND_TOOLING_SCRIPTS.items():
        if package_scripts.get(name) != expected:
            problems.append(f"frontend {name} script must be {expected}")

    workflow_path = repo_root / ".github" / "workflows" / "uok-ci.yml"
    if not workflow_path.is_file():
        problems.append("frontend protected CI workflow missing")
        return problems

    workflow = workflow_path.read_text(encoding="utf-8")
    for command in _FRONTEND_CI_COMMANDS:
        if command not in workflow:
            problems.append(f"frontend protected CI command missing: {command}")
    build_command = "npm run build:static"
    budget_command = "npm run check:bundle-budget"
    if (
        build_command in workflow
        and budget_command in workflow
        and workflow.index(budget_command) < workflow.index(build_command)
    ):
        problems.append("frontend bundle budget CI gate must run after the build")
    return problems


def _durable_javascript_problems(repo_root: Path) -> list[str]:
    src_root = repo_root / "src"
    if str(src_root) not in sys.path:
        sys.path.insert(0, str(src_root))
    from uok.module_manifest_loader import load_module_manifests

    source_roots = [repo_root / "web" / "src"]
    problems: list[str] = []
    for module_name, manifest in load_module_manifests(repo_root / "modules").items():
        source_root, problem = _safe_module_web_root(
            repo_root, module_name, str(manifest["web_path"])
        )
        if problem:
            problems.append(problem)
        elif source_root is not None:
            source_roots.append(source_root)
    problems.extend(
        f"durable JavaScript source is not allowed: {path.as_posix()}"
        for source_root in source_roots
        if source_root.is_dir()
        for path in source_root.rglob("*")
        if path.is_file() and is_durable_javascript(path) and "generated" not in path.parts
    )
    return problems


def _safe_module_web_root(
    repo_root: Path, module_name: str, raw_path: str
) -> tuple[Path | None, str | None]:
    declared = Path(raw_path)
    if (
        "\\" in raw_path
        or declared.is_absolute()
        or ".." in declared.parts
        or declared.parts[:2] != ("modules", module_name)
    ):
        return None, f"unsafe frontend web_path for {module_name}: {raw_path}"
    candidate = repo_root / declared
    try:
        resolved = candidate.resolve(strict=True)
        owner_root = (repo_root / "modules" / module_name).resolve(strict=True)
    except (OSError, RuntimeError):
        return None, f"unresolvable frontend web_path for {module_name}: {raw_path}"
    if not resolved.is_relative_to(owner_root):
        return None, f"escaping frontend web_path for {module_name}: {raw_path}"
    current = candidate
    reparse_flag = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0)
    while current != owner_root.parent:
        metadata = current.lstat()
        if current.is_symlink() or getattr(metadata, "st_file_attributes", 0) & reparse_flag:
            return None, f"linked frontend web_path for {module_name}: {raw_path}"
        if current.resolve() == owner_root:
            break
        current = current.parent
    return resolved, None


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))
