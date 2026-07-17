from __future__ import annotations

from pathlib import Path

from tests.kernel_host_backend_boundary_support import (
    MODULE_HOST_IMPORT_ALLOWLIST,
    allowlisted_host_import,
    dependency_path_to_host,
    feature_backend_violations,
    feature_package,
    feature_security_import_allowed,
    kernel_violations,
    resolve_source_module,
    source_dependency_graph,
)
from tests.kernel_host_shell_boundary_support import (
    feature_backend_packages,
    feature_module_runtime_import_allowed,
    import_candidates,
    python_imports,
)


ROOT = Path(__file__).resolve().parents[1]
KERNEL_ROOT = ROOT / "src" / "uok" / "kernel"


def test_kernel_is_framework_and_feature_independent() -> None:
    assert KERNEL_ROOT.is_dir()
    packages = feature_backend_packages(ROOT)
    violations = [
        violation
        for path in sorted(KERNEL_ROOT.rglob("*.py"))
        for violation in kernel_violations(ROOT, path, packages)
    ]
    assert violations == []


def test_feature_backends_do_not_import_host_composition() -> None:
    violations = [
        violation
        for path in sorted((ROOT / "modules").glob("*/backend/**/*.py"))
        for violation in feature_backend_violations(ROOT, path)
    ]
    assert violations == []


def test_feature_backends_have_no_transitive_host_dependency() -> None:
    graph, module_paths = source_dependency_graph(ROOT)
    violations: list[str] = []
    for path in sorted((ROOT / "modules").glob("*/backend/**/*.py")):
        package = feature_package(path)
        relative_path = path.relative_to(ROOT).as_posix()
        references = python_imports(
            path.read_text(encoding="utf-8"),
            f"{package}.{path.stem}",
        )
        for reference in references:
            if allowlisted_host_import(relative_path, reference):
                continue
            for candidate in sorted(import_candidates(reference)):
                target = resolve_source_module(candidate, module_paths)
                if target is None:
                    continue
                dependency_path = dependency_path_to_host(graph, target)
                if dependency_path:
                    violations.append(
                        f"{relative_path}:{reference.line} reaches host via "
                        f"{' -> '.join(dependency_path)}"
                    )
                    break
    assert violations == []


def test_host_import_allowlist_is_path_and_symbol_exact() -> None:
    assert len(MODULE_HOST_IMPORT_ALLOWLIST) == 33
    allowed = python_imports(
        "from uok.host.database import get_db",
        "feature.api",
    )[0]
    forbidden = [
        python_imports(source, "feature.api")[0]
        for source in (
            "from uok.host.database import SessionLocal",
            "from uok.host.security import issue_token",
            "from uok.host.commands import command_handlers",
            "import uok.host.database",
        )
    ]
    path = "modules/calendar.core/backend/uok_calendar_core/api.py"
    assert allowlisted_host_import(path, allowed)
    assert not any(allowlisted_host_import(path, reference) for reference in forbidden)
    assert not allowlisted_host_import(
        "modules/calendar.core/backend/uok_calendar_core/service.py",
        allowed,
    )

    read_only_adapter_paths = (
        "modules/product.master/backend/uok_product_master/_internal/delivery/api.py",
        "modules/locations.core/backend/uok_locations_core/_internal/delivery/api.py",
        "modules/routes.core/backend/uok_routes_core/_internal/delivery/api.py",
    )
    current_actor = python_imports(
        "from uok.host.security import current_actor",
        "feature.api",
    )[0]
    execute_command = python_imports(
        "from uok.host.commands import execute_command",
        "feature.api",
    )[0]
    for adapter_path in read_only_adapter_paths:
        assert allowlisted_host_import(adapter_path, allowed)
        assert allowlisted_host_import(adapter_path, current_actor)
        assert not allowlisted_host_import(adapter_path, execute_command)
    assert not allowlisted_host_import(
        "modules/product.master/backend/uok_product_master/_internal/delivery/service.py",
        allowed,
    )


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


def test_feature_module_runtime_imports_are_named_and_mutations_are_private() -> None:
    allowed = python_imports(
        "from uok.kernel.module_runtime import module_catalog, ensure_module_operational",
        "feature.api",
    )[0]
    lifecycle_mutator = python_imports(
        "from uok.kernel.module_runtime import install_module",
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
    assert not feature_module_runtime_import_allowed(lifecycle_mutator)
    assert feature_module_runtime_import_allowed(
        lifecycle_mutator,
        allow_lifecycle_mutations=True,
    )
    assert not any(
        feature_module_runtime_import_allowed(reference)
        for reference in forbidden
    )


def test_feature_security_imports_are_named_and_configuration_is_private() -> None:
    allowed = python_imports(
        "from uok.kernel.security import Actor, require_permission",
        "feature.api",
    )[0]
    forbidden = [
        python_imports(source, "feature.api")[0]
        for source in (
            "import uok.kernel.security",
            "from uok.kernel.security import *",
            "from uok.kernel.security import configure_role_grants",
        )
    ]
    assert feature_security_import_allowed(allowed)
    assert not any(
        feature_security_import_allowed(reference)
        for reference in forbidden
    )
