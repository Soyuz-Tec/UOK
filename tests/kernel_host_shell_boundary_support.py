from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path


TS_SPECIFIER_PATTERN = re.compile(
    r"(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)"
    r"[\"']([^\"']+)[\"']"
)
FEATURE_MODULE_RUNTIME_SYMBOLS = {
    "OPERATIONAL_STATUSES",
    "disable_module",
    "enable_module",
    "ensure_module_operational",
    "install_module",
    "module_catalog",
    "module_contracts",
    "module_declared",
    "module_lifecycle_report",
    "module_maintenance_report",
    "module_record_status",
    "module_status",
    "reconcile_module_record",
    "uninstall_module",
    "upgrade_module",
}
MODULE_LIFECYCLE_MUTATORS = {
    "disable_module",
    "enable_module",
    "install_module",
    "reconcile_module_record",
    "uninstall_module",
    "upgrade_module",
}


@dataclass(frozen=True)
class PythonImport:
    target: str
    names: tuple[str, ...] | None
    aliases: tuple[str | None, ...]
    line: int
    dynamic: bool = False


@dataclass(frozen=True)
class TypeScriptSpecifier:
    target: str
    line: int


def python_imports(source: str, module_name: str) -> list[PythonImport]:
    tree = ast.parse(source)
    imports: list[PythonImport] = []
    import_module_names = {"__import__"}
    importlib_names: set[str] = set()

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "importlib" or alias.name.startswith("importlib."):
                    importlib_names.add(alias.asname or "importlib")
        elif isinstance(node, ast.ImportFrom) and node.module == "importlib":
            for alias in node.names:
                if alias.name == "import_module":
                    import_module_names.add(alias.asname or alias.name)

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.extend(
                PythonImport(alias.name, None, (alias.asname,), node.lineno)
                for alias in node.names
            )
        elif isinstance(node, ast.ImportFrom):
            target = _absolute_from_target(module_name, node.level, node.module)
            imports.append(
                PythonImport(
                    target,
                    tuple(alias.name for alias in node.names),
                    tuple(alias.asname for alias in node.names),
                    node.lineno,
                )
            )
        elif isinstance(node, ast.Call) and node.args and _is_dynamic_import(
            node.func, import_module_names, importlib_names
        ):
            argument = node.args[0]
            if isinstance(argument, ast.Constant) and isinstance(argument.value, str):
                imports.append(
                    PythonImport(argument.value, None, (), node.lineno, dynamic=True)
                )
    return imports


def import_candidates(reference: PythonImport) -> set[str]:
    candidates = {reference.target}
    if reference.names:
        candidates.update(
            f"{reference.target}.{name}" if reference.target else name
            for name in reference.names
            if name != "*"
        )
    return candidates


def feature_module_runtime_import_allowed(
    reference: PythonImport,
    *,
    allow_lifecycle_mutations: bool = False,
) -> bool:
    names = set(reference.names or ())
    return bool(
        reference.target == "uok.kernel.module_runtime"
        and not reference.dynamic
        and reference.names is not None
        and names.issubset(FEATURE_MODULE_RUNTIME_SYMBOLS)
        and (allow_lifecycle_mutations or names.isdisjoint(MODULE_LIFECYCLE_MUTATORS))
        and reference.aliases == tuple(None for _ in reference.names)
    )


def python_module_name(path: Path, root: Path) -> str:
    relative = path.relative_to(root / "src").with_suffix("")
    return ".".join(relative.parts)


def feature_backend_packages(root: Path) -> set[str]:
    packages: set[str] = set()
    for backend in (root / "modules").glob("*/backend"):
        packages.update(
            child.name
            for child in backend.iterdir()
            if child.is_dir() and (child / "__init__.py").is_file()
        )
    return packages


def typescript_specifiers(source: str) -> list[TypeScriptSpecifier]:
    return [
        TypeScriptSpecifier(
            match.group(1),
            source.count("\n", 0, match.start()) + 1,
        )
        for match in TS_SPECIFIER_PATTERN.finditer(source)
    ]


def production_typescript_files(root: Path) -> set[Path]:
    scan_roots = [
        root / "web" / "src",
        *sorted(
            path / "web" / "src"
            for path in (root / "modules").iterdir()
            if (path / "web" / "src").is_dir()
        ),
    ]
    return {
        path.resolve()
        for scan_root in scan_roots
        for path in scan_root.rglob("*")
        if path.suffix in {".ts", ".tsx"}
        and ".test." not in path.name
        and ".spec." not in path.name
        and not {"node_modules", "dist", "coverage"}.intersection(path.parts)
    }


def resolve_typescript_target(
    source_path: Path,
    specifier: str,
    root: Path,
    files: set[Path],
) -> Path | None:
    if specifier.startswith("@uok/"):
        base = root / "web" / "src" / specifier.removeprefix("@uok/")
    elif specifier.startswith("@uok-modules/"):
        base = root / "modules" / specifier.removeprefix("@uok-modules/")
    elif specifier.startswith("."):
        base = source_path.parent / specifier
    else:
        return None
    for candidate in _typescript_candidates(base):
        resolved = candidate.resolve()
        if resolved in files:
            return resolved
    return None


def typescript_graph(root: Path) -> dict[Path, set[Path]]:
    files = production_typescript_files(root)
    graph = {path: set() for path in files}
    for path in files:
        source = path.read_text(encoding="utf-8")
        for reference in typescript_specifiers(source):
            target = resolve_typescript_target(path, reference.target, root, files)
            if target is not None:
                graph[path].add(target)
    return graph


def strongly_connected_components(
    graph: dict[Path, set[Path]],
) -> list[list[Path]]:
    index = 0
    indices: dict[Path, int] = {}
    lowlinks: dict[Path, int] = {}
    stack: list[Path] = []
    on_stack: set[Path] = set()
    components: list[list[Path]] = []

    def visit(node: Path) -> None:
        nonlocal index
        indices[node] = lowlinks[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for target in graph[node]:
            if target not in indices:
                visit(target)
                lowlinks[node] = min(lowlinks[node], lowlinks[target])
            elif target in on_stack:
                lowlinks[node] = min(lowlinks[node], indices[target])
        if lowlinks[node] != indices[node]:
            return
        component: list[Path] = []
        while True:
            target = stack.pop()
            on_stack.remove(target)
            component.append(target)
            if target == node:
                break
        components.append(component)

    for node in graph:
        if node not in indices:
            visit(node)
    return components


def frontend_owner(path: Path, root: Path) -> str:
    relative = path.relative_to(root).parts
    if relative[:2] == ("web", "src"):
        return "shell"
    if len(relative) >= 4 and relative[0] == "modules":
        return f"module:{relative[1]}"
    raise ValueError(f"unknown frontend owner for {path}")


def _absolute_from_target(
    module_name: str,
    level: int,
    imported_module: str | None,
) -> str:
    if level == 0:
        return imported_module or ""
    package = module_name.split(".")[:-1]
    keep = max(0, len(package) - (level - 1))
    parts = package[:keep]
    if imported_module:
        parts.extend(imported_module.split("."))
    return ".".join(parts)


def _is_dynamic_import(
    function: ast.expr,
    import_module_names: set[str],
    importlib_names: set[str],
) -> bool:
    if isinstance(function, ast.Name):
        return function.id in import_module_names
    return bool(
        isinstance(function, ast.Attribute)
        and function.attr == "import_module"
        and isinstance(function.value, ast.Name)
        and function.value.id in importlib_names
    )


def _typescript_candidates(base: Path) -> tuple[Path, ...]:
    return (
        base,
        Path(f"{base}.ts"),
        Path(f"{base}.tsx"),
        Path(f"{base}.d.ts"),
        base / "index.ts",
        base / "index.tsx",
    )
