from __future__ import annotations

import ast
from pathlib import Path

import pytest

from uok.module_manifest_loader import load_module_manifests


ROOT = Path(__file__).resolve().parents[1]
ROUTE_BACKEND = ROOT / "modules" / "routes.core" / "backend" / "uok_routes_core"
ROUTE_MIGRATIONS = ROOT / "modules" / "routes.core" / "migrations"
LOCATION_PACKAGE = "uok_locations_core"
LOCATION_PUBLIC_API = f"{LOCATION_PACKAGE}.public_api"
ALLOWED_LOCATION_SYMBOLS = {
    "LocationReferenceResolution",
    "resolve_location_references",
}
FORBIDDEN_LOCATION_TOKENS = {
    "LocationDefinition",
    "LocationNameHistory",
    "location_definitions",
    "location_name_history",
}
SQLALCHEMY_ESCAPE_HATCHES = {"MetaData", "Table", "inspect", "text"}


def _literal_string(node: ast.AST) -> str | None:
    return node.value if isinstance(node, ast.Constant) and isinstance(node.value, str) else None


def _location_import_violations(tree: ast.AST) -> list[tuple[int, str]]:
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == LOCATION_PACKAGE or alias.name.startswith(LOCATION_PACKAGE + "."):
                    violations.append((node.lineno, f"unsupported module import {alias.name}"))
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if node.module == LOCATION_PUBLIC_API:
                for alias in node.names:
                    if alias.name not in ALLOWED_LOCATION_SYMBOLS:
                        violations.append(
                            (node.lineno, f"unsupported Location public symbol {alias.name}")
                        )
            elif node.module == LOCATION_PACKAGE or node.module.startswith(LOCATION_PACKAGE + "."):
                violations.append((node.lineno, f"private Location import {node.module}"))
        elif isinstance(node, ast.Call) and node.args:
            function_name = _call_name(node.func)
            target = _literal_string(node.args[0])
            if (
                function_name in {"__import__", "import_module"}
                and target
                and (target == LOCATION_PACKAGE or target.startswith(LOCATION_PACKAGE + "."))
            ):
                violations.append((node.lineno, f"dynamic Location import {target}"))
    return violations


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _sqlalchemy_escape_aliases(tree: ast.AST) -> tuple[set[str], set[str]]:
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


def _raw_sql_or_reflection_violations(tree: ast.AST) -> list[tuple[int, str]]:
    escape_aliases, module_aliases = _sqlalchemy_escape_aliases(tree)
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
        function_name = _call_name(node.func)
        if function_name in escape_aliases:
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


def _forbidden_token_violations(source: str) -> list[str]:
    lowered = source.casefold()
    return sorted(
        token
        for token in FORBIDDEN_LOCATION_TOKENS
        if token.casefold() in lowered
    )


def _python_violations(source: str) -> list[tuple[int, str]]:
    tree = ast.parse(source)
    violations = _location_import_violations(tree)
    violations.extend(_raw_sql_or_reflection_violations(tree))
    violations.extend((1, f"foreign Location token {token}") for token in _forbidden_token_violations(source))
    return sorted(set(violations))


def test_routes_backend_uses_only_the_location_owner_public_contract() -> None:
    assert ROUTE_BACKEND.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: {reason}"
        for path in sorted(ROUTE_BACKEND.rglob("*.py"))
        for line, reason in _python_violations(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_routes_migrations_never_reference_location_owner_tables() -> None:
    assert ROUTE_MIGRATIONS.is_dir()
    violations = [
        f"{path.relative_to(ROOT).as_posix()}: foreign Location token {token}"
        for path in sorted(ROUTE_MIGRATIONS.glob("*.sql"))
        for token in _forbidden_token_violations(path.read_text(encoding="utf-8"))
    ]
    assert violations == []


def test_routes_manifest_declares_location_as_its_only_feature_dependency() -> None:
    manifest = load_module_manifests()["routes.core"]
    assert manifest["required"] is False
    assert manifest["dependencies"] == ["locations.core"]
    assert manifest["api_prefixes"] == ["/api/routes"]
    assert set(manifest["permissions"]) == {"routes.read", "routes.manage"}
    assert set(manifest["commands"]) == {
        f"{action}RouteDefinition" for action in ("Create", "Update", "Archive", "Restore")
    }
    assert set(manifest["events"]) == {
        f"RouteDefinition{action}" for action in ("Created", "Updated", "Archived", "Restored")
    }
    assert {
        "RouteDefinition",
        "RouteStop",
        "RouteNameHistory",
    }.issubset(set(manifest["owned_tables"]))


@pytest.mark.parametrize(
    "source",
    [
        "import uok_locations_core.public_api as location_api",
        "from uok_locations_core.public_api import api_router",
        "from uok_locations_core._internal.persistence.models import LocationDefinition",
        "from importlib import import_module\nimport_module('uok_locations_core._internal')",
        "from sqlalchemy import text\nsession.execute(text('SELECT 1'))",
        "import sqlalchemy as sa\nsession.execute(sa.text('SELECT 1'))",
        "from sqlalchemy import MetaData\nmetadata = MetaData()\nmetadata.reflect(bind=engine)",
        "table = RouteDefinition.__table__",
        "table = Base.metadata.tables['location_definitions']",
        "session.exec_driver_sql('SELECT 1')",
        "from sqlalchemy import ForeignKey\nForeignKey('location_definitions.id')",
    ],
)
def test_route_boundary_scanner_rejects_location_bypasses(source: str) -> None:
    assert _python_violations(source)


def test_route_boundary_scanner_allows_exact_location_public_symbols() -> None:
    source = (
        "from uok_locations_core.public_api import "
        "LocationReferenceResolution, resolve_location_references"
    )
    assert _python_violations(source) == []
