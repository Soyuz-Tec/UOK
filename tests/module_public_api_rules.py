from __future__ import annotations

import ast
import re
from pathlib import Path

from uok.host.module_paths import repo_root
from tests.module_public_api_contract import (
    FRONTEND_ALLOWED_IMPORTS,
    FRONTEND_MODULES,
    FRONTEND_SPECIFIER_PATTERN,
    MODULES,
    PRIVILEGED_PYTHON_IMPORT_PATHS,
)


def _owner(relative_path: Path) -> str | None:
    if len(relative_path.parts) >= 2 and relative_path.parts[0] == "modules":
        for owner, contract in MODULES.items():
            if relative_path.parts[1] == contract["folder"]:
                return owner
    return None


def python_violations(source: str, relative_path: Path) -> list[str]:
    tree = ast.parse(source, filename=relative_path.as_posix())
    owner = _owner(relative_path)
    privileged = relative_path in PRIVILEGED_PYTHON_IMPORT_PATHS
    test_source = (
        relative_path.parts[0] == "tests"
        or "tests" in relative_path.parts[:3]
    )
    violations: list[str] = []

    def validate_kernel_model_access(
        target: str,
        names: list[str] | None,
        line: int,
    ) -> bool:
        if target == "uok" and names is not None and "models" in names:
            violations.append(
                f"{relative_path.as_posix()}:{line} imports retired "
                "module-owned ORM facade uok.models"
            )
            return True
        if target != "uok.models":
            return False
        violations.append(
            f"{relative_path.as_posix()}:{line} imports retired "
            "module-owned ORM facade uok.models"
        )
        return True

    def validate(target: str, names: list[str] | None, line: int) -> None:
        if validate_kernel_model_access(target, names, line):
            return
        for module_owner, contract in MODULES.items():
            package = str(contract["package"])
            if target != package and not target.startswith(package + "."):
                continue
            if owner == module_owner or privileged:
                return
            public_module = contract["public_module"]
            if public_module is None or target != public_module:
                violations.append(
                    f"{relative_path.as_posix()}:{line} imports private {target}"
                )
                return
            if names is None:
                if test_source:
                    return
                violations.append(
                    f"{relative_path.as_posix()}:{line} imports facade module "
                    f"object {public_module}; use named supported symbols"
                )
                return
            allowed = set(contract["symbols"])
            forbidden = sorted(
                name for name in names if name == "*" or name not in allowed
            )
            if forbidden:
                violations.append(
                    f"{relative_path.as_posix()}:{line} imports unsupported "
                    f"{public_module} symbols {forbidden}"
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
            validate(
                node.module,
                [alias.name for alias in node.names],
                node.lineno,
            )
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


def frontend_violations(source: str, relative_path: Path) -> list[str]:
    owner = _owner(relative_path)
    violations = []
    root = repo_root()
    module_folders = "|".join(
        re.escape(str(contract["folder"])) for contract in FRONTEND_MODULES.values()
    )
    for match in FRONTEND_SPECIFIER_PATTERN.finditer(source):
        target = match.group(1)
        module_owner: str | None = None
        suffix = ""
        alias_match = re.fullmatch(
            rf"@uok-modules/({module_folders})/web/src/(.+)",
            target,
        )
        if alias_match:
            module_folder, suffix = alias_match.groups()
            module_owner = next(
                candidate_owner
                for candidate_owner, contract in FRONTEND_MODULES.items()
                if contract["folder"] == module_folder
            )
        elif target.startswith("."):
            resolved = (root / relative_path.parent / target).resolve()
            for candidate_owner, contract in FRONTEND_MODULES.items():
                module_source = (
                    root / "modules" / str(contract["folder"]) / "web" / "src"
                ).resolve()
                if resolved == module_source or resolved.is_relative_to(module_source):
                    module_owner = candidate_owner
                    suffix = resolved.relative_to(module_source).as_posix()
                    break
        if module_owner is None or owner == module_owner:
            continue
        if suffix not in FRONTEND_ALLOWED_IMPORTS[module_owner]:
            line = source.count("\n", 0, match.start()) + 1
            violations.append(
                f"{relative_path.as_posix()}:{line} imports private {target}"
            )
    return violations


__all__ = ["frontend_violations", "python_violations"]
