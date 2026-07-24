from __future__ import annotations

import ast
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
PLANNING_BACKEND = ROOT / "modules" / "planning.core" / "backend" / "uok_planning_core"
ALLOWED_OWNER_PUBLIC_API_SYMBOLS = {
    "uok_calendar_core.public_api": {
        "CalendarEventReferenceResolution",
        "freebusy_rows_for_participants",
        "occurrence_rows_for_participants",
        "resolve_calendar_event_reference",
    },
    "uok_communications_core.public_api": {
        "CommunicationThreadReferenceResolution",
        "resolve_communication_thread_reference",
    },
    "uok_contacts_core.public_api": {
        "PartyReferenceResolution",
        "resolve_party_reference",
    },
    "uok_reports_core.public_api": {
        "ReportArtifactReferenceResolution",
        "resolve_report_artifact_reference",
    },
}
FORBIDDEN_KERNEL_BACKDOORS = {
    "uok.calendar_models",
    "uok.communication_models",
    "uok.models",
    "uok.module_model_registry",
}


def _foreign_backend_packages() -> set[str]:
    packages: set[str] = set()
    for backend in (ROOT / "modules").glob("*/backend"):
        if backend.parent.name == "planning.core":
            continue
        packages.update(
            child.name
            for child in backend.iterdir()
            if child.is_dir() and (child / "__init__.py").is_file()
        )
    return packages


def _is_forbidden_module(module_name: str, foreign_packages: set[str]) -> bool:
    if module_name in ALLOWED_OWNER_PUBLIC_API_SYMBOLS:
        return False
    if module_name in FORBIDDEN_KERNEL_BACKDOORS:
        return True
    if module_name.startswith("uok.contact_") or module_name.startswith("uok.contacts"):
        return True
    return any(
        module_name == package or module_name.startswith(package + ".")
        for package in foreign_packages
    )


def _illegal_imports(source: str, foreign_packages: set[str]) -> list[tuple[int, str]]:
    tree = ast.parse(source)
    violations: list[tuple[int, str]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            # Require named public-API imports so the scanner can validate the
            # exact contract member and cannot be bypassed with private attrs.
            violations.extend(
                (node.lineno, alias.name)
                for alias in node.names
                if alias.name in ALLOWED_OWNER_PUBLIC_API_SYMBOLS
                or _is_forbidden_module(alias.name, foreign_packages)
            )
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            module_name = node.module
            if module_name in ALLOWED_OWNER_PUBLIC_API_SYMBOLS:
                allowed_symbols = ALLOWED_OWNER_PUBLIC_API_SYMBOLS[module_name]
                violations.extend(
                    (node.lineno, f"{module_name}.{alias.name}")
                    for alias in node.names
                    if alias.name not in allowed_symbols
                )
            else:
                candidates = [module_name, *(f"{module_name}.{alias.name}" for alias in node.names)]
                violations.extend(
                    (node.lineno, candidate)
                    for candidate in candidates
                    if _is_forbidden_module(candidate, foreign_packages)
                )
        else:
            continue
    return sorted(violations)


def test_planning_backend_imports_other_modules_only_through_public_apis() -> None:
    foreign_packages = _foreign_backend_packages()
    assert foreign_packages >= {
        "uok_calendar_core",
        "uok_communications_core",
        "uok_contacts_core",
        "uok_reports_core",
    }
    violations = [
        f"{path.relative_to(ROOT).as_posix()}:{line}: illegal import {module_name}"
        for path in sorted(PLANNING_BACKEND.rglob("*.py"))
        for line, module_name in _illegal_imports(path.read_text(encoding="utf-8"), foreign_packages)
    ]
    assert violations == []


@pytest.mark.parametrize(
    "source",
    [
        "from uok.models import Party",
        "from uok import models",
        "from uok import calendar_models",
        "from uok_contacts_core.models import Party",
        "import uok_contacts_core.public_api as contacts_api",
        "from uok_contacts_core.public_api import Party",
        "from uok_calendar_core.schemas import CalendarEventResponse",
        "import uok_communications_core.service",
        "from uok_reports_core import models",
        "from uok.contact_access import can_read_party",
    ],
)
def test_planning_boundary_scanner_rejects_foreign_implementation_imports(source: str) -> None:
    assert _illegal_imports(source, _foreign_backend_packages())


def test_planning_boundary_scanner_allows_exact_owner_public_api() -> None:
    source = "from uok_contacts_core.public_api import resolve_party_reference"
    assert _illegal_imports(source, _foreign_backend_packages()) == []
