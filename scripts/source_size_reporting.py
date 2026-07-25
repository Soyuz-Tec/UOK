from __future__ import annotations

from source_size_configuration import SizeException, SourceSizeConfiguration
from source_size_rules import SourceAnalysis, SourceFinding


def _exception_dict(exception: SizeException) -> dict[str, object]:
    return {
        "identity": exception.identity,
        "kind": exception.kind,
        "path": exception.path,
        "symbol": exception.symbol,
        "max_lines": exception.max_lines,
        "owner": exception.owner,
        "reason": exception.reason,
        "issue": exception.issue,
        "expires_on": exception.expires_on.isoformat(),
    }


def empty_ratchet() -> dict[str, object]:
    return {
        "status": "not_evaluated",
        "new_count": 0,
        "growth_count": 0,
        "resolved_count": 0,
        "baseline_count": 0,
        "current_count": 0,
    }


def configuration_finding(config_path: str, message: str) -> SourceFinding:
    return SourceFinding(
        f"configuration:{config_path}",
        "configuration",
        config_path,
        0,
        0,
        "hard",
        "configuration_invalid",
        message,
    )


def build_report(
    schema: str,
    analysis: SourceAnalysis,
    blockers: tuple[SourceFinding, ...],
    ratchet: dict[str, object],
    active_exceptions: tuple[dict[str, object], ...],
) -> dict[str, object]:
    hard_rules = {"file_hard_300", "function_hard_120"}
    return {
        "schema": schema,
        "ok": not blockers,
        "scanned_file_count": analysis.scanned_file_count,
        "hard_count": len(blockers),
        "soft_count": len(analysis.soft),
        "hard_cap_count": sum(item.rule in hard_rules for item in analysis.hard),
        "active_exception_count": len(active_exceptions),
        "hard_findings": [item.as_dict() for item in blockers],
        "soft_findings": [item.as_dict() for item in analysis.soft],
        "active_exceptions": list(active_exceptions),
        "ratchet": ratchet,
    }


def _applicable_exception(
    exception: SizeException,
    by_identity: dict[str, list[SourceFinding]],
) -> bool:
    findings = by_identity.get(exception.identity)
    if not findings:
        return False
    return all(
        finding.kind in {"file", "function"} and finding.lines <= exception.max_lines
        for finding in findings
    )


def _unused_exception_finding(exception: SizeException) -> SourceFinding:
    return SourceFinding(
        f"exception:{exception.identity}",
        "configuration",
        exception.path,
        0,
        exception.max_lines,
        "hard",
        "exception_unused",
        "configured exception does not match an applicable current violation",
    )


def apply_exceptions(
    blockers: tuple[SourceFinding, ...],
    configuration: SourceSizeConfiguration,
) -> tuple[tuple[SourceFinding, ...], tuple[dict[str, object], ...]]:
    by_identity: dict[str, list[SourceFinding]] = {}
    for finding in blockers:
        by_identity.setdefault(finding.identity, []).append(finding)
    active = tuple(
        _exception_dict(exception)
        for exception in configuration.exceptions
        if _applicable_exception(exception, by_identity)
    )
    active_ids = {str(item["identity"]) for item in active}
    remaining = [item for item in blockers if item.identity not in active_ids]
    remaining.extend(
        _unused_exception_finding(exception)
        for exception in configuration.exceptions
        if exception.identity not in active_ids
    )
    return (
        tuple(sorted(remaining, key=lambda item: (item.identity, item.rule))),
        active,
    )


def _finding_list(value: object) -> list[object]:
    return list(value) if isinstance(value, list) else []


def _format_finding(item: object) -> str:
    finding = item if isinstance(item, dict) else {}
    location = str(finding.get("path"))
    if finding.get("line") is not None:
        location += f":{finding['line']}"
    return (
        f"{location}: {finding.get('lines')}/{finding.get('threshold')} "
        f"{finding.get('reason')}"
    )


def _format_finding_group(
    label: str,
    findings: list[object],
    limit: int,
) -> str:
    shown = findings[: max(0, limit)]
    marker = (
        f"{label} [total={len(findings)} shown={len(shown)} "
        f"omitted={len(findings) - len(shown)}]"
    )
    return (
        marker
        if not shown
        else marker + ": " + "; ".join(_format_finding(item) for item in shown)
    )


def summarize_source_size_policy(
    report: dict[str, object],
    limit: int = 12,
) -> str:
    hard = _finding_list(report.get("hard_findings"))
    soft = _finding_list(report.get("soft_findings"))
    if not hard and not soft:
        return "within hard limits; no soft warnings"
    groups = []
    if hard:
        groups.append(_format_finding_group("hard", hard, limit))
    if soft:
        groups.append(_format_finding_group("soft", soft, limit))
    return " | ".join(groups)


def _cli_summary(report: dict[str, object], ratchet: dict[object, object]) -> str:
    status = "PASS" if report.get("ok") else "FAIL"
    return (
        f"source-size policy {status}: scanned={report.get('scanned_file_count', 0)} "
        f"hard={report.get('hard_count', 0)} soft={report.get('soft_count', 0)} "
        f"exceptions={report.get('active_exception_count', 0)}; "
        f"ratchet={ratchet.get('status', 'not_evaluated')} "
        f"baseline={ratchet.get('baseline_count', 0)} "
        f"current={ratchet.get('current_count', 0)} "
        f"new={ratchet.get('new_count', 0)} "
        f"growth={ratchet.get('growth_count', 0)} "
        f"resolved={ratchet.get('resolved_count', 0)}"
    )


def format_source_size_cli(report: dict[str, object], limit: int = 5) -> str:
    ratchet_value = report.get("ratchet")
    ratchet = ratchet_value if isinstance(ratchet_value, dict) else {}
    summary = _cli_summary(report, ratchet)
    blocking = _finding_list(report.get("hard_findings"))
    if report.get("ok") or not blocking:
        return summary
    return summary + "\n" + _format_finding_group("blocking", blocking, limit)
