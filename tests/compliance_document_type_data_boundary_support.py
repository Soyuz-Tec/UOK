from __future__ import annotations

import ast
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPLIANCE_BACKEND = (
    ROOT / "modules" / "compliance.core" / "backend" / "uok_compliance_core"
)
COMPLIANCE_MIGRATIONS = ROOT / "modules" / "compliance.core" / "migrations"
MODEL_REGISTRY_FIXTURE = ROOT / "tests" / "fixtures" / "module_model_registry.json"
FORBIDDEN_KERNEL_BACKDOORS = {
    "uok.models",
    "uok.module_model_registry",
}
SQLALCHEMY_ESCAPE_HATCHES = {"MetaData", "Table", "inspect", "text"}


def feature_backend_packages() -> set[str]:
    packages: set[str] = set()
    for backend in (ROOT / "modules").glob("*/backend"):
        if backend.parent.name == "compliance.core":
            continue
        packages.update(
            child.name
            for child in backend.iterdir()
            if child.is_dir() and (child / "__init__.py").is_file()
        )
    return packages


def foreign_model_and_table_tokens() -> tuple[set[str], set[str]]:
    registry = json.loads(MODEL_REGISTRY_FIXTURE.read_text(encoding="utf-8"))
    foreign_owners = {
        owner: models
        for owner, models in registry.items()
        if owner not in {"kernel", "compliance.core"}
    }
    return (
        {
            model_name
            for models in foreign_owners.values()
            for model_name in models
        },
        {
            table_name
            for models in foreign_owners.values()
            for table_name in models.values()
        },
    )


def call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def literal_string(node: ast.AST) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def foreign_import_violations(
    tree: ast.AST,
    foreign_packages: set[str],
) -> list[tuple[int, str]]:
    violations: list[tuple[int, str]] = []

    def is_foreign(target: str) -> bool:
        return target in FORBIDDEN_KERNEL_BACKDOORS or any(
            target == package or target.startswith(package + ".")
            for package in foreign_packages
        )

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if is_foreign(alias.name):
                    violations.append((node.lineno, f"foreign module import {alias.name}"))
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if is_foreign(node.module):
                violations.append((node.lineno, f"foreign module import {node.module}"))
        elif isinstance(node, ast.Call) and node.args:
            target = literal_string(node.args[0])
            if (
                call_name(node.func) in {"__import__", "import_module"}
                and target
                and is_foreign(target)
            ):
                violations.append((node.lineno, f"dynamic foreign import {target}"))
    return violations


def sqlalchemy_escape_aliases(tree: ast.AST) -> tuple[set[str], set[str]]:
    call_aliases: set[str] = set()
    module_aliases: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            module_aliases.update(
                alias.asname or alias.name.split(".", 1)[0]
                for alias in node.names
                if alias.name == "sqlalchemy" or alias.name.startswith("sqlalchemy.")
            )
        elif isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("sqlalchemy"):
            call_aliases.update(
                alias.asname or alias.name
                for alias in node.names
                if alias.name in SQLALCHEMY_ESCAPE_HATCHES
            )
    return call_aliases, module_aliases


def raw_sql_or_reflection_violations(tree: ast.AST) -> list[tuple[int, str]]:
    call_aliases, module_aliases = sqlalchemy_escape_aliases(tree)
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Attribute) and node.attr == "__table__":
            violations.append((node.lineno, "SQLAlchemy table reflection"))
            continue
        if (
            isinstance(node, ast.Attribute)
            and node.attr == "tables"
            and isinstance(node.value, ast.Attribute)
            and node.value.attr == "metadata"
        ):
            violations.append((node.lineno, "SQLAlchemy metadata reflection"))
            continue
        if not isinstance(node, ast.Call):
            continue
        function_name = call_name(node.func)
        if function_name in call_aliases:
            violations.append((node.lineno, f"SQLAlchemy escape hatch {function_name}"))
        if (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id in module_aliases
            and function_name in SQLALCHEMY_ESCAPE_HATCHES
        ):
            violations.append((node.lineno, f"SQLAlchemy escape hatch {function_name}"))
        if function_name in {"exec_driver_sql", "reflect"}:
            violations.append((node.lineno, f"raw SQL/reflection call {function_name}"))
        if function_name == "execute" and node.args and isinstance(
            node.args[0], (ast.Constant, ast.JoinedStr)
        ):
            violations.append((node.lineno, "raw string passed to execute"))
        if any(keyword.arg == "autoload_with" for keyword in node.keywords):
            violations.append((node.lineno, "SQLAlchemy autoload reflection"))
    return violations


def foreign_model_or_table_violations(tree: ast.AST) -> list[tuple[int, str]]:
    model_names, table_names = foreign_model_and_table_tokens()
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id in model_names:
            violations.append((node.lineno, f"foreign ORM symbol {node.id}"))
        elif isinstance(node, ast.Attribute) and node.attr in model_names:
            violations.append((node.lineno, f"foreign ORM symbol {node.attr}"))
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            lowered = node.value.casefold().strip()
            for table_name in table_names:
                if (
                    lowered == table_name
                    or f"{table_name}." in lowered
                    or re.search(
                        rf"\b(?:alter\s+table|create\s+table|delete\s+from|"
                        rf"drop\s+table|from|insert\s+into|join|references|update)"
                        rf"\s+{re.escape(table_name)}\b",
                        lowered,
                    )
                ):
                    violations.append((node.lineno, f"foreign table token {table_name}"))
    return violations


def python_violations(source: str) -> list[tuple[int, str]]:
    tree = ast.parse(source)
    violations = foreign_import_violations(tree, feature_backend_packages())
    violations.extend(raw_sql_or_reflection_violations(tree))
    violations.extend(foreign_model_or_table_violations(tree))
    return sorted(set(violations))


def foreign_migration_tokens(source: str) -> list[str]:
    _model_names, table_names = foreign_model_and_table_tokens()
    lowered = source.casefold()
    return sorted(table_name for table_name in table_names if table_name in lowered)
