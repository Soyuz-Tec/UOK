from __future__ import annotations

from pathlib import Path

from tests.kernel_host_shell_boundary_support import (
    PythonImport,
    feature_module_runtime_import_allowed,
    import_candidates,
    python_imports,
    python_module_name,
)


LEGACY_COMPOSITION_MODULES = {
    "uok.calendar_models",
    "uok.command_context",
    "uok.commands",
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
    "uok.security",
}
MODULE_HTTP_ADAPTERS = {
    "modules/apps.manager/backend/uok_apps_manager/api.py",
    "modules/calendar.core/backend/uok_calendar_core/api.py",
    "modules/communications.core/backend/uok_communications_core/api.py",
    "modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api.py",
    "modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_groups.py",
    "modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_system.py",
    "modules/locations.core/backend/uok_locations_core/_internal/delivery/api.py",
    "modules/planning.core/backend/uok_planning_core/_internal/analysis/analysis_api.py",
    "modules/planning.core/backend/uok_planning_core/_internal/delivery/api.py",
    "modules/planning.core/backend/uok_planning_core/_internal/portfolio_audit/portfolio_api.py",
    "modules/planning.core/backend/uok_planning_core/_internal/portfolio_audit/revision_api.py",
    "modules/planning.core/backend/uok_planning_core/_internal/resources/resource_calendar_api.py",
    "modules/product.master/backend/uok_product_master/_internal/delivery/api.py",
    "modules/reports.core/backend/uok_reports_core/api.py",
    "modules/routes.core/backend/uok_routes_core/_internal/delivery/api.py",
}
MODULE_COMMAND_ADAPTERS = {
    "modules/calendar.core/backend/uok_calendar_core/api.py",
    "modules/contacts.core/backend/uok_contacts_core/_internal/delivery/api_support.py",
    "modules/planning.core/backend/uok_planning_core/_internal/delivery/api_support.py",
}
MODULE_HOST_IMPORT_ALLOWLIST = (
    {(path, "uok.host.database", ("get_db",)) for path in MODULE_HTTP_ADAPTERS}
    | {(path, "uok.host.security", ("current_actor",)) for path in MODULE_HTTP_ADAPTERS}
    | {
        (path, "uok.host.commands", ("execute_command",))
        for path in MODULE_COMMAND_ADAPTERS
    }
)
FEATURE_SECURITY_SYMBOLS = {
    "Actor",
    "effective_role_permissions",
    "has_permission",
    "require_permission",
    "role_grants_configured",
}


def kernel_violations(
    root: Path,
    path: Path,
    feature_packages: set[str],
) -> list[str]:
    references = python_imports(
        path.read_text(encoding="utf-8"),
        python_module_name(path, root),
    )
    forbidden = {"fastapi", "starlette", "uok.host", *feature_packages}
    return [
        f"{path.relative_to(root).as_posix()}:{reference.line} imports {target}"
        for reference in references
        for target in sorted(import_candidates(reference))
        if matches_prefix(target, forbidden)
    ]


def feature_backend_violations(root: Path, path: Path) -> list[str]:
    package = feature_package(path)
    relative_path = path.relative_to(root).as_posix()
    references = python_imports(
        path.read_text(encoding="utf-8"),
        f"{package}.{path.stem}",
    )
    violations: list[str] = []
    for reference in references:
        candidates = import_candidates(reference)
        if any(matches_prefix(target, {"uok.kernel.module_runtime"}) for target in candidates):
            if not feature_module_runtime_import_allowed(
                reference,
                allow_lifecycle_mutations=package == "uok_apps_manager",
            ):
                violations.append(
                    f"{relative_path}:{reference.line} imports host-only module runtime configuration"
                )
            continue
        if any(matches_prefix(target, {"uok.kernel.security"}) for target in candidates):
            if not feature_security_import_allowed(reference):
                violations.append(
                    f"{relative_path}:{reference.line} imports host-only security configuration"
                )
            continue
        if reference.target.startswith("uok.host"):
            if not allowlisted_host_import(relative_path, reference):
                violations.append(
                    f"{relative_path}:{reference.line} uses non-allowlisted host import"
                )
            continue
        if any(matches_prefix(target, {"uok.host", *LEGACY_COMPOSITION_MODULES}) for target in candidates):
            violations.append(
                f"{relative_path}:{reference.line} imports host/composition {reference.target}"
            )
        if (
            reference.target.startswith("uok")
            and reference.names
            and {"engine", "SessionLocal"}.intersection(reference.names)
        ):
            violations.append(
                f"{relative_path}:{reference.line} imports engine/session factory"
            )
    return violations


def feature_security_import_allowed(reference: PythonImport) -> bool:
    return bool(
        reference.target == "uok.kernel.security"
        and not reference.dynamic
        and reference.names is not None
        and set(reference.names).issubset(FEATURE_SECURITY_SYMBOLS)
    )


def allowlisted_host_import(relative_path: str, reference: PythonImport) -> bool:
    return bool(
        not reference.dynamic
        and reference.names is not None
        and reference.aliases == tuple(None for _ in reference.names)
        and (relative_path, reference.target, reference.names) in MODULE_HOST_IMPORT_ALLOWLIST
    )


def feature_package(path: Path) -> str:
    return next(
        child.name
        for child in path.parents
        if child.parent.name == "backend" and (child / "__init__.py").is_file()
    )


def source_dependency_graph(root: Path) -> tuple[dict[str, set[str]], dict[str, Path]]:
    module_paths: dict[str, Path] = {}
    parser_names: dict[str, str] = {}
    for path in sorted((root / "src" / "uok").rglob("*.py")):
        parts = list(path.relative_to(root / "src").with_suffix("").parts)
        parser_name = ".".join(parts)
        if parts[-1] == "__init__":
            parts.pop()
        module_name = ".".join(parts)
        module_paths[module_name] = path
        parser_names[module_name] = parser_name

    graph = {module_name: set() for module_name in module_paths}
    for module_name, path in module_paths.items():
        references = python_imports(
            path.read_text(encoding="utf-8"),
            parser_names[module_name],
        )
        for reference in references:
            for candidate in import_candidates(reference):
                target = resolve_source_module(candidate, module_paths)
                if target is not None and target != module_name:
                    graph[module_name].add(target)
    return graph, module_paths


def resolve_source_module(
    candidate: str,
    module_paths: dict[str, Path],
) -> str | None:
    target = candidate
    while target:
        if target in module_paths:
            return target
        target = target.rpartition(".")[0]
    return None


def dependency_path_to_host(
    graph: dict[str, set[str]],
    start: str,
) -> list[str]:
    pending: list[tuple[str, list[str]]] = [(start, [start])]
    visited: set[str] = set()
    while pending:
        node, path = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        if node == "uok.host" or node.startswith("uok.host."):
            return path
        pending.extend((target, [*path, target]) for target in graph.get(node, set()))
    return []


def matches_prefix(target: str, prefixes: set[str]) -> bool:
    return any(
        target == prefix or target.startswith(prefix + ".")
        for prefix in prefixes
    )
