from __future__ import annotations

import ast
from dataclasses import dataclass
from pathlib import Path


SOURCE_ROOTS = ("src", "modules", "web/src", "tests", "scripts", "migrations")
SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".css", ".ps1", ".sql"}
EXCLUDED_PARTS = {"node_modules", "static", "generated", "__pycache__", ".pytest_cache"}
HARD_LINE_LIMIT = 300
FUNCTION_LINE_LIMIT = 60


@dataclass(frozen=True)
class SourceFinding:
    path: str
    lines: int
    threshold: int
    severity: str
    reason: str


def is_source_file(path: Path) -> bool:
    return (
        path.is_file()
        and path.suffix in SOURCE_SUFFIXES
        and not EXCLUDED_PARTS.intersection(path.parts)
    )


def source_files(repo_root: Path) -> list[Path]:
    files: list[Path] = []
    for root_name in SOURCE_ROOTS:
        root = repo_root / root_name
        if root.exists():
            files.extend(path for path in root.rglob("*") if is_source_file(path))
    return sorted(files)


def soft_line_limit(relative_path: str, suffix: str) -> int | None:
    parts = relative_path.split("/")
    name = parts[-1]
    if suffix == ".tsx":
        return 200
    if suffix == ".css":
        return None
    if "tests" in parts or name.startswith("test_"):
        return 200
    if name in {"api.py", "routes.py"} or name.endswith("_api.py"):
        return 200
    if "command" in name or "commands" in name:
        return 200
    if suffix == ".py" and any(token in name for token in ("read_model", "service", "policy")):
        return 250
    if suffix in {".ps1", ".sql", ".ts"}:
        return 250
    return None


def file_line_findings(path: Path, repo_root: Path) -> list[SourceFinding]:
    relative = path.relative_to(repo_root).as_posix()
    line_count = len(path.read_text(encoding="utf-8", errors="ignore").splitlines())
    findings: list[SourceFinding] = []
    if line_count > HARD_LINE_LIMIT:
        findings.append(
            SourceFinding(relative, line_count, HARD_LINE_LIMIT, "hard", "file exceeds hard line limit")
        )
    soft_limit = soft_line_limit(relative, path.suffix)
    if soft_limit is not None and line_count > soft_limit:
        findings.append(
            SourceFinding(relative, line_count, soft_limit, "soft", "file exceeds soft review threshold")
        )
    return findings


def python_function_findings(path: Path, repo_root: Path) -> list[SourceFinding]:
    if path.suffix != ".py":
        return []
    relative = path.relative_to(repo_root).as_posix()
    try:
        tree = ast.parse(path.read_text(encoding="utf-8", errors="ignore"))
    except SyntaxError:
        return []
    findings: list[SourceFinding] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            continue
        if node.end_lineno is None:
            continue
        line_count = node.end_lineno - node.lineno + 1
        if line_count > FUNCTION_LINE_LIMIT:
            findings.append(
                SourceFinding(
                    f"{relative}:{node.lineno}",
                    line_count,
                    FUNCTION_LINE_LIMIT,
                    "soft",
                    f"function {node.name} exceeds preferred length",
                )
            )
    return findings


def run_source_size_policy(repo_root: Path) -> dict[str, object]:
    findings: list[SourceFinding] = []
    for path in source_files(repo_root):
        findings.extend(file_line_findings(path, repo_root))
        findings.extend(python_function_findings(path, repo_root))
    hard = [finding.__dict__ for finding in findings if finding.severity == "hard"]
    soft = [finding.__dict__ for finding in findings if finding.severity == "soft"]
    return {
        "ok": not hard,
        "hard_count": len(hard),
        "soft_count": len(soft),
        "hard_findings": hard,
        "soft_findings": soft,
    }


def summarize_source_size_policy(report: dict[str, object], limit: int = 12) -> str:
    hard = report["hard_findings"]
    soft = report["soft_findings"]
    if not hard and not soft:
        return "within hard limits; no soft warnings"
    parts: list[str] = []
    if hard:
        parts.append("hard: " + "; ".join(_format_finding(item) for item in hard[:limit]))
    if soft:
        parts.append("soft: " + "; ".join(_format_finding(item) for item in soft[:limit]))
    return " | ".join(parts)


def _format_finding(item: object) -> str:
    finding = item if isinstance(item, dict) else {}
    return (
        f"{finding.get('path')}: {finding.get('lines')}/"
        f"{finding.get('threshold')} {finding.get('reason')}"
    )
