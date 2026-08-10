from __future__ import annotations

from source_size_configuration_types import BaselineEntry, SourceSizeConfiguration
from source_size_rules import SourceFinding


def _blocking_copy(
    finding: SourceFinding,
    threshold: int,
    rule: str,
    reason: str,
) -> SourceFinding:
    return SourceFinding(
        finding.identity,
        finding.kind,
        finding.path,
        finding.lines,
        threshold,
        "hard",
        rule,
        reason,
        finding.symbol,
        finding.line,
    )


def _identity_path(identity: str) -> str:
    return identity.split(":", 1)[1].split("::", 1)[0]


def _current_and_baseline(
    soft_findings: tuple[SourceFinding, ...],
    configuration: SourceSizeConfiguration,
) -> tuple[dict[str, SourceFinding], dict[str, BaselineEntry]]:
    current = {item.identity: item for item in soft_findings}
    baseline = {item.identity: item for item in configuration.baseline}
    return current, baseline


def _ratchet_identities(
    current: dict[str, SourceFinding],
    baseline: dict[str, BaselineEntry],
) -> tuple[list[str], list[str], list[str]]:
    new = sorted(set(current) - set(baseline))
    resolved = sorted(set(baseline) - set(current))
    growth = sorted(
        identity
        for identity in set(current).intersection(baseline)
        if current[identity].lines > baseline[identity].max_lines
    )
    return new, resolved, growth


def _new_blockers(
    identities: list[str],
    current: dict[str, SourceFinding],
) -> list[SourceFinding]:
    return [
        _blocking_copy(
            current[identity],
            current[identity].threshold,
            "ratchet_new",
            "new soft size debt is not in the baseline",
        )
        for identity in identities
    ]


def _growth_blockers(
    identities: list[str],
    current: dict[str, SourceFinding],
    baseline: dict[str, BaselineEntry],
) -> list[SourceFinding]:
    return [
        _blocking_copy(
            current[identity],
            baseline[identity].max_lines,
            "ratchet_growth",
            "soft size debt grew above its baseline maximum",
        )
        for identity in identities
    ]


def _resolved_blockers(
    identities: list[str],
    baseline: dict[str, BaselineEntry],
) -> list[SourceFinding]:
    return [
        SourceFinding(
            identity,
            "baseline",
            _identity_path(identity),
            0,
            baseline[identity].max_lines,
            "hard",
            "ratchet_resolved",
            "baseline entry no longer matches current soft debt and must be removed",
        )
        for identity in identities
    ]


def _ratchet_report(
    new: list[str],
    resolved: list[str],
    growth: list[str],
    baseline_count: int,
    current_count: int,
) -> dict[str, object]:
    if new or growth:
        status = "violations"
    elif resolved:
        status = "baseline_update_required"
    else:
        status = "clean"
    return {
        "status": status,
        "new_count": len(new),
        "growth_count": len(growth),
        "resolved_count": len(resolved),
        "baseline_count": baseline_count,
        "current_count": current_count,
    }


def reconcile_source_size(
    soft_findings: tuple[SourceFinding, ...],
    hard_findings: tuple[SourceFinding, ...],
    configuration: SourceSizeConfiguration,
) -> tuple[dict[str, object], tuple[SourceFinding, ...]]:
    current, baseline = _current_and_baseline(soft_findings, configuration)
    new, resolved, growth = _ratchet_identities(current, baseline)
    ratchet_blockers = [
        *_new_blockers(new, current),
        *_growth_blockers(growth, current, baseline),
        *_resolved_blockers(resolved, baseline),
    ]
    blockers = [*hard_findings, *ratchet_blockers]
    ratchet = _ratchet_report(
        new,
        resolved,
        growth,
        len(baseline),
        len(current),
    )
    return (
        ratchet,
        tuple(sorted(blockers, key=lambda item: (item.identity, item.rule))),
    )
