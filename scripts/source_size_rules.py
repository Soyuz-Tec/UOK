from __future__ import annotations

from pathlib import Path

from source_size_discovery import (
    discover_source_files,
    hard_finding,
    relative_source_path,
)
from source_size_models import (
    EXCLUDED_DIRECTORY_NAMES,
    EXCLUDED_TREE_PREFIXES,
    HARD_FILE_LINE_LIMIT,
    HARD_FUNCTION_LINE_LIMIT,
    SOFT_FOCUSED_FILE_LINE_LIMIT,
    SOFT_FUNCTION_LINE_LIMIT,
    SOFT_GENERAL_FILE_LINE_LIMIT,
    SOURCE_ROOTS,
    SOURCE_SUFFIXES,
    FunctionSpan,
    SourceAnalysis,
    SourceFinding,
    file_identity,
    function_identity,
    is_excluded_tree,
    is_python_function_exempt,
    is_test_file,
    normalized_relative_path,
    soft_file_limit,
)
from source_size_python import python_findings


__all__ = [
    "EXCLUDED_DIRECTORY_NAMES",
    "EXCLUDED_TREE_PREFIXES",
    "HARD_FILE_LINE_LIMIT",
    "HARD_FUNCTION_LINE_LIMIT",
    "SOFT_FOCUSED_FILE_LINE_LIMIT",
    "SOFT_FUNCTION_LINE_LIMIT",
    "SOFT_GENERAL_FILE_LINE_LIMIT",
    "SOURCE_ROOTS",
    "SOURCE_SUFFIXES",
    "FunctionSpan",
    "SourceAnalysis",
    "SourceFinding",
    "analyze_source_size",
    "file_identity",
    "function_identity",
    "is_excluded_tree",
    "is_python_function_exempt",
    "is_test_file",
    "normalized_relative_path",
    "soft_file_limit",
]


def _file_findings(path: str, suffix: str, lines: int) -> list[SourceFinding]:
    identity = file_identity(path)
    soft_limit = soft_file_limit(path, suffix)
    findings = []
    if lines > soft_limit:
        findings.append(
            SourceFinding(
                identity,
                "file",
                path,
                lines,
                soft_limit,
                "soft",
                f"file_soft_{soft_limit}",
                "file exceeds soft review threshold",
            )
        )
    if lines > HARD_FILE_LINE_LIMIT:
        findings.append(
            SourceFinding(
                identity,
                "file",
                path,
                lines,
                HARD_FILE_LINE_LIMIT,
                "hard",
                "file_hard_300",
                "file exceeds hard line limit",
            )
        )
    return findings


def _read_source(path: Path, relative: str) -> tuple[str | None, SourceFinding | None]:
    try:
        return path.read_text(encoding="utf-8", errors="strict"), None
    except (OSError, UnicodeError) as exc:
        finding = hard_finding(
            f"decode:{relative}",
            "decode",
            relative,
            "source_utf8",
            f"source must be readable strict UTF-8: {exc}",
        )
        return None, finding


def _source_findings(
    source_path: Path,
    relative: str,
    source: str,
) -> list[SourceFinding]:
    findings = _file_findings(
        relative,
        source_path.suffix,
        len(source.splitlines()),
    )
    if source_path.suffix == ".py":
        findings.extend(python_findings(relative, source))
    return findings


def _sorted_findings(
    findings: list[SourceFinding],
    severity: str,
) -> tuple[SourceFinding, ...]:
    return tuple(
        sorted(
            (item for item in findings if item.severity == severity),
            key=lambda item: (item.identity, item.rule),
        )
    )


def analyze_source_size(repo_root: Path) -> SourceAnalysis:
    root = repo_root.resolve(strict=True)
    files, findings = discover_source_files(root)
    for source_path in files:
        relative = relative_source_path(source_path, root)
        source, read_failure = _read_source(source_path, relative)
        if read_failure is not None:
            findings.append(read_failure)
            continue
        if source is not None:
            findings.extend(_source_findings(source_path, relative, source))
    return SourceAnalysis(
        len(files),
        _sorted_findings(findings, "hard"),
        _sorted_findings(findings, "soft"),
    )
