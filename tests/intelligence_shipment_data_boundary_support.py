from __future__ import annotations

import ast
import re
from pathlib import Path

from tests.kernel_host_shell_boundary_support import typescript_specifiers


ROOT = Path(__file__).resolve().parents[1]
INTELLIGENCE_BACKEND = (
    ROOT / "modules" / "intelligence.core" / "backend" / "uok_intelligence_core"
)
INTELLIGENCE_MIGRATIONS = ROOT / "modules" / "intelligence.core" / "migrations"
INTELLIGENCE_WEB = ROOT / "modules" / "intelligence.core" / "web" / "src"
SHIPMENT_BACKEND = (
    ROOT / "modules" / "shipments.core" / "backend" / "uok_shipments_core"
)

SHIPMENT_PACKAGE = "uok_shipments_core"
SHIPMENT_PUBLIC_API = f"{SHIPMENT_PACKAGE}.public_api"
ALLOWED_SHIPMENT_SYMBOLS = {
    "ShipmentReadinessSnapshotDTO",
    "resolve_shipment_readiness_snapshots",
}
FORBIDDEN_FEATURE_PACKAGES = {
    "uok_agents_core",
    "uok_apps_manager",
    "uok_calendar_core",
    "uok_communications_core",
    "uok_compliance_core",
    "uok_contacts_core",
    "uok_locations_core",
    "uok_planning_core",
    "uok_product_master",
    "uok_reports_core",
    "uok_routes_core",
}
SHIPMENT_ORM_SYMBOLS = {
    "Shipment",
    "ShipmentDocumentInstance",
    "ShipmentDocumentInstanceHistory",
    "ShipmentDocumentRequirement",
    "ShipmentDocumentRequirementHistory",
    "ShipmentStatusHistory",
}
SHIPMENT_TABLE_NAMES = {
    "shipments",
    "shipment_document_instances",
    "shipment_document_instance_history",
    "shipment_document_requirements",
    "shipment_document_requirement_history",
    "shipment_status_history",
}
SQLALCHEMY_ESCAPE_HATCHES = {"ForeignKey", "MetaData", "Table", "inspect", "text"}
ORM_MAPPING_TOKENS = {"DeclarativeBase", "Mapped", "mapped_column", "relationship"}


def _call_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _literal_string(node: ast.AST) -> str | None:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _is_package(target: str, package: str) -> bool:
    return target == package or target.startswith(package + ".")


def _intelligence_import_violations(tree: ast.AST) -> list[tuple[int, str]]:
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _is_package(alias.name, SHIPMENT_PACKAGE):
                    violations.append(
                        (node.lineno, f"unsupported Shipment module import {alias.name}")
                    )
                elif any(
                    _is_package(alias.name, package)
                    for package in FORBIDDEN_FEATURE_PACKAGES
                ):
                    violations.append(
                        (node.lineno, f"forbidden feature import {alias.name}")
                    )
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if node.module == SHIPMENT_PUBLIC_API:
                for alias in node.names:
                    if alias.name not in ALLOWED_SHIPMENT_SYMBOLS:
                        violations.append(
                            (
                                node.lineno,
                                f"unsupported Shipment public symbol {alias.name}",
                            )
                        )
            elif _is_package(node.module, SHIPMENT_PACKAGE):
                violations.append(
                    (node.lineno, f"private Shipment import {node.module}")
                )
            elif any(
                _is_package(node.module, package)
                for package in FORBIDDEN_FEATURE_PACKAGES
            ):
                violations.append(
                    (node.lineno, f"forbidden feature import {node.module}")
                )
        elif isinstance(node, ast.Call) and node.args:
            target = _literal_string(node.args[0])
            if (
                _call_name(node.func) in {"__import__", "import_module"}
                and target
                and (
                    _is_package(target, SHIPMENT_PACKAGE)
                    or any(
                        _is_package(target, package)
                        for package in FORBIDDEN_FEATURE_PACKAGES
                    )
                )
            ):
                violations.append(
                    (node.lineno, f"dynamic feature import {target}")
                )
    return violations


def _sqlalchemy_aliases(tree: ast.AST) -> tuple[set[str], set[str]]:
    call_aliases: set[str] = set()
    module_aliases: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            module_aliases.update(
                alias.asname or alias.name.split(".", 1)[0]
                for alias in node.names
                if alias.name == "sqlalchemy"
                or alias.name.startswith("sqlalchemy.")
            )
        elif (
            isinstance(node, ast.ImportFrom)
            and node.module
            and node.module.startswith("sqlalchemy")
        ):
            call_aliases.update(
                alias.asname or alias.name
                for alias in node.names
                if alias.name in SQLALCHEMY_ESCAPE_HATCHES
            )
    return call_aliases, module_aliases


def _orm_or_sql_violations(tree: ast.AST) -> list[tuple[int, str]]:
    call_aliases, module_aliases = _sqlalchemy_aliases(tree)
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id in SHIPMENT_ORM_SYMBOLS:
            violations.append((node.lineno, f"Shipment ORM symbol {node.id}"))
        elif (
            isinstance(node, ast.Attribute)
            and node.attr in SHIPMENT_ORM_SYMBOLS
        ):
            violations.append((node.lineno, f"Shipment ORM symbol {node.attr}"))
        elif isinstance(node, ast.Attribute) and node.attr == "__table__":
            violations.append((node.lineno, "SQLAlchemy table reflection"))
        elif (
            isinstance(node, ast.Attribute)
            and node.attr == "tables"
            and isinstance(node.value, ast.Attribute)
            and node.value.attr == "metadata"
        ):
            violations.append((node.lineno, "SQLAlchemy metadata reflection"))
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            lowered = node.value.casefold()
            for table_name in SHIPMENT_TABLE_NAMES:
                if re.search(
                    rf"\b(?:alter\s+table|create\s+table|delete\s+from|"
                    rf"drop\s+table|from|insert\s+into|join|references|update)"
                    rf"\s+{re.escape(table_name)}\b",
                    lowered,
                ):
                    violations.append(
                        (node.lineno, f"Shipment table token {table_name}")
                    )
        if not isinstance(node, ast.Call):
            continue
        function_name = _call_name(node.func)
        if function_name in call_aliases:
            violations.append(
                (node.lineno, f"SQLAlchemy escape hatch {function_name}")
            )
        if (
            isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id in module_aliases
            and function_name in SQLALCHEMY_ESCAPE_HATCHES
        ):
            violations.append(
                (node.lineno, f"SQLAlchemy escape hatch {function_name}")
            )
        if function_name in {"exec_driver_sql", "reflect"}:
            violations.append(
                (node.lineno, f"raw SQL/reflection call {function_name}")
            )
        if function_name == "execute" and node.args and isinstance(
            node.args[0], (ast.Constant, ast.JoinedStr)
        ):
            violations.append((node.lineno, "raw string passed to execute"))
        if any(keyword.arg == "autoload_with" for keyword in node.keywords):
            violations.append((node.lineno, "SQLAlchemy autoload reflection"))
    return violations


def intelligence_python_violations(source: str) -> list[tuple[int, str]]:
    tree = ast.parse(source)
    violations = _intelligence_import_violations(tree)
    violations.extend(_orm_or_sql_violations(tree))
    return sorted(set(violations))


def shipment_reverse_import_violations(source: str) -> list[tuple[int, str]]:
    tree = ast.parse(source)
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if _is_package(alias.name, "uok_intelligence_core"):
                    violations.append(
                        (node.lineno, f"reverse Intelligence import {alias.name}")
                    )
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if _is_package(node.module, "uok_intelligence_core"):
                violations.append(
                    (node.lineno, f"reverse Intelligence import {node.module}")
                )
        elif isinstance(node, ast.Call) and node.args:
            target = _literal_string(node.args[0])
            if (
                _call_name(node.func) in {"__import__", "import_module"}
                and target
                and _is_package(target, "uok_intelligence_core")
            ):
                violations.append(
                    (node.lineno, f"dynamic reverse Intelligence import {target}")
                )
    return sorted(set(violations))


def intelligence_frontend_violations(source: str) -> list[tuple[int, str]]:
    violations: list[tuple[int, str]] = []
    lowered = source.casefold()
    if "/api/shipments" in lowered:
        violations.append((1, "direct Shipment HTTP access"))
    for reference in typescript_specifiers(source):
        if "shipments.core" in reference.target.casefold():
            violations.append(
                (reference.line, f"Shipment frontend import {reference.target}")
            )
    for match in re.finditer(r"""["'`](/api/[^"'`]+)""", source):
        if not match.group(1).startswith("/api/intelligence"):
            line = source.count("\n", 0, match.start()) + 1
            violations.append(
                (line, f"foreign feature HTTP path {match.group(1)}")
            )
    return sorted(set(violations))


def intelligence_persistence_violations(source: str) -> list[str]:
    violations = [
        token
        for token in ORM_MAPPING_TOKENS
        if re.search(rf"\b{re.escape(token)}\b", source)
    ]
    if "__tablename__" in source:
        violations.append("__tablename__")
    return sorted(violations)


__all__ = [
    "ALLOWED_SHIPMENT_SYMBOLS",
    "INTELLIGENCE_BACKEND",
    "INTELLIGENCE_MIGRATIONS",
    "INTELLIGENCE_WEB",
    "ROOT",
    "SHIPMENT_BACKEND",
    "intelligence_frontend_violations",
    "intelligence_persistence_violations",
    "intelligence_python_violations",
    "shipment_reverse_import_violations",
]
