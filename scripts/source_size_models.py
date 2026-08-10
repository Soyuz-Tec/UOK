from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import PurePosixPath


SOURCE_ROOTS = ("src", "modules", "web", "tests", "scripts", "migrations", "deploy")
SOURCE_SUFFIXES = frozenset({".py", ".ts", ".tsx", ".css", ".ps1", ".sql"})
EXCLUDED_DIRECTORY_NAMES = frozenset(
    {"node_modules", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache"}
)
EXCLUDED_TREE_PREFIXES = (
    "src/uok/static/app",
    "web/src/generated",
    "web/dist",
    "web/coverage",
    "web/test-results",
    "web/playwright-report",
)
HARD_FILE_LINE_LIMIT = 300
SOFT_FOCUSED_FILE_LINE_LIMIT = 200
SOFT_GENERAL_FILE_LINE_LIMIT = 250
SOFT_FUNCTION_LINE_LIMIT = 60
HARD_FUNCTION_LINE_LIMIT = 120
API_ROUTE_TOKENS = frozenset({"api", "apis", "route", "routes", "router", "routers"})
COMMAND_TOKENS = frozenset({"command", "commands"})
CAMEL_CASE_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])")


@dataclass(frozen=True)
class SourceFinding:
    identity: str
    kind: str
    path: str
    lines: int
    threshold: int
    severity: str
    rule: str
    reason: str
    symbol: str | None = None
    line: int | None = None

    def as_dict(self) -> dict[str, object]:
        result: dict[str, object] = {
            field: getattr(self, field)
            for field in (
                "identity",
                "kind",
                "path",
                "lines",
                "threshold",
                "severity",
                "rule",
                "reason",
            )
        }
        if self.symbol is not None:
            result["symbol"] = self.symbol
        if self.line is not None:
            result["line"] = self.line
        return result


@dataclass(frozen=True)
class SourceAnalysis:
    scanned_file_count: int
    hard: tuple[SourceFinding, ...]
    soft: tuple[SourceFinding, ...]


@dataclass(frozen=True)
class FunctionSpan:
    qualified_name: str
    line: int
    lines: int


def file_identity(relative_path: str) -> str:
    return f"file:{relative_path}"


def function_identity(relative_path: str, qualified_name: str) -> str:
    return f"function:{relative_path}::{qualified_name}"


def normalized_relative_path(value: str) -> str:
    path = PurePosixPath(value)
    if (
        not value
        or value != value.strip()
        or "\\" in value
        or path.is_absolute()
        or any(part in {"", ".", ".."} for part in path.parts)
    ):
        raise ValueError("path must be a normalized repository-relative POSIX path")
    return path.as_posix()


def is_excluded_tree(relative_path: str) -> bool:
    return any(
        relative_path == prefix or relative_path.startswith(f"{prefix}/")
        for prefix in EXCLUDED_TREE_PREFIXES
    )


def is_test_file(relative_path: str) -> bool:
    path = PurePosixPath(relative_path)
    return (
        "tests" in path.parts
        or "e2e" in path.parts
        or path.name.startswith("test_")
        or ".test." in path.name
        or ".spec." in path.name
    )


def is_python_function_exempt(relative_path: str) -> bool:
    path = PurePosixPath(relative_path)
    module_verifier = (
        len(path.parts) >= 4
        and path.parts[0] == "modules"
        and path.parts[2] == "verify"
    )
    return is_test_file(relative_path) or module_verifier


def _stem_tokens(stem: str) -> set[str]:
    separated = CAMEL_CASE_BOUNDARY.sub(" ", stem)
    return {token.lower() for token in re.split(r"[^A-Za-z0-9]+", separated) if token}


def _has_api_route_directory(path: PurePosixPath) -> bool:
    return any(part.lower() in API_ROUTE_TOKENS for part in path.parts[:-1])


def soft_file_limit(relative_path: str, suffix: str) -> int:
    path = PurePosixPath(relative_path)
    stem = path.stem
    tokens = _stem_tokens(stem)
    route = (
        suffix in {".py", ".ts", ".tsx"} and bool(tokens.intersection(API_ROUTE_TOKENS))
    ) or (suffix == ".py" and _has_api_route_directory(path))
    command = suffix == ".py" and bool(tokens.intersection(COMMAND_TOKENS))
    hook = suffix in {".ts", ".tsx"} and (
        "hooks" in path.parts
        or (stem.startswith("use") and len(stem) > 3 and stem[3].isupper())
    )
    if is_test_file(relative_path) or route or command or suffix == ".tsx" or hook:
        return SOFT_FOCUSED_FILE_LINE_LIMIT
    return SOFT_GENERAL_FILE_LINE_LIMIT
