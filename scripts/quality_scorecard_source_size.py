from __future__ import annotations

from typing import Any


SOFT_RULES_BY_KIND = {
    "file": {"file_soft_200", "file_soft_250"},
    "function": {"function_soft_60"},
}
RATCHET_COUNT_FIELDS = (
    "new_count",
    "growth_count",
    "resolved_count",
    "baseline_count",
    "current_count",
)


def _nonnegative_int(value: Any) -> int:
    return value if type(value) is int and value >= 0 else 0


def _soft_finding_dimensions(value: Any) -> tuple[str, str, str, str] | None:
    if not isinstance(value, dict):
        return None
    kind = value.get("kind")
    path = value.get("path")
    identity = value.get("identity")
    rule = value.get("rule")
    if (
        type(kind) is not str
        or kind not in SOFT_RULES_BY_KIND
        or type(path) is not str
        or not path
        or path != path.strip()
        or type(identity) is not str
        or type(rule) is not str
        or rule not in SOFT_RULES_BY_KIND[kind]
    ):
        return None
    symbol = value.get("symbol")
    expected_identity = f"file:{path}"
    if kind == "function":
        if type(symbol) is not str or not symbol or symbol != symbol.strip():
            return None
        expected_identity = f"function:{path}::{symbol}"
    if identity != expected_identity:
        return None
    return kind, path, identity, rule


def soft_finding_metrics(findings: list[Any]) -> dict[str, Any]:
    by_kind = {"file": 0, "function": 0}
    by_rule: dict[str, int] = {}
    paths: set[str] = set()
    identities: set[str] = set()
    malformed = 0
    for finding in findings:
        dimensions = _soft_finding_dimensions(finding)
        if dimensions is None:
            malformed += 1
            continue
        kind, path, identity, rule = dimensions
        by_kind[kind] += 1
        by_rule[rule] = by_rule.get(rule, 0) + 1
        paths.add(path)
        identities.add(identity)
    return {
        "file_count": by_kind["file"],
        "function_count": by_kind["function"],
        "affected_path_count": len(paths),
        "identity_count": len(identities),
        "malformed_count": malformed,
        "by_rule": dict(sorted(by_rule.items())),
    }


def _ratchet_metrics(value: Any) -> dict[str, Any]:
    ratchet = value if isinstance(value, dict) else {}
    return {
        "status": str(ratchet.get("status", "not_supplied")),
        **{
            field: _nonnegative_int(ratchet.get(field, 0))
            for field in RATCHET_COUNT_FIELDS
        },
    }


def source_size_metrics(source_size_report: dict[str, Any] | None) -> dict[str, Any]:
    report = source_size_report if isinstance(source_size_report, dict) else {}
    soft_value = report.get("soft_findings", [])
    soft_findings = soft_value if isinstance(soft_value, list) else []
    findings = soft_finding_metrics(soft_findings)
    hard_count = _nonnegative_int(report.get("hard_count", 0))
    soft_count = _nonnegative_int(report.get("soft_count", len(soft_findings)))
    return {
        "report_schema": str(report.get("schema", "not_supplied")),
        "scanned_file_count": _nonnegative_int(report.get("scanned_file_count", 0)),
        "hard_count": hard_count,
        "hard_cap_count": _nonnegative_int(report.get("hard_cap_count", 0)),
        "soft_count": soft_count,
        "active_exception_count": _nonnegative_int(
            report.get("active_exception_count", 0)
        ),
        "ratchet": _ratchet_metrics(report.get("ratchet")),
        "soft_file_warning_count": findings["file_count"],
        "soft_function_warning_count": findings["function_count"],
        "soft_affected_path_count": findings["affected_path_count"],
        "soft_warning_identity_count": findings["identity_count"],
        "soft_malformed_finding_count": findings["malformed_count"],
        "soft_warnings_by_rule": findings["by_rule"],
        "hard_warning_count": hard_count,
        "soft_warning_count": soft_count,
    }
