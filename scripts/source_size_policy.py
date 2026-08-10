from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

from source_size_configuration import (
    CONFIG_SCHEMA,
    SourceSizeConfigurationError,
    load_source_size_configuration,
    reconcile_source_size,
)
from source_size_reporting import (
    apply_exceptions,
    build_report,
    configuration_finding,
    empty_ratchet,
    format_source_size_cli,
    summarize_source_size_policy,
)
from source_size_rules import SourceAnalysis, analyze_source_size


REPORT_SCHEMA = "uok.source_size_report.v1"
DEFAULT_CONFIG_PATH = "config/source_size_policy.json"


__all__ = [
    "DEFAULT_CONFIG_PATH",
    "REPORT_SCHEMA",
    "build_baseline_payload",
    "format_source_size_cli",
    "main",
    "run_source_size_policy",
    "summarize_source_size_policy",
]


def _configuration_error_report(
    analysis: SourceAnalysis,
    message: str,
) -> dict[str, object]:
    blocker = configuration_finding(DEFAULT_CONFIG_PATH, message)
    blockers = tuple(
        sorted(
            (*analysis.hard, blocker),
            key=lambda item: (item.identity, item.rule),
        )
    )
    return build_report(REPORT_SCHEMA, analysis, blockers, empty_ratchet(), ())


def run_source_size_policy(
    repo_root: Path,
    *,
    config_path: Path | None = None,
    today: date | None = None,
) -> dict[str, object]:
    root = repo_root.resolve(strict=True)
    analysis = analyze_source_size(root)
    effective_config = config_path or root / DEFAULT_CONFIG_PATH
    try:
        configuration = load_source_size_configuration(
            effective_config,
            today=today,
        )
    except SourceSizeConfigurationError as exc:
        return _configuration_error_report(analysis, str(exc))
    ratchet, ratchet_blockers = reconcile_source_size(
        analysis.soft,
        analysis.hard,
        configuration,
    )
    blockers, active = apply_exceptions(ratchet_blockers, configuration)
    return build_report(REPORT_SCHEMA, analysis, blockers, ratchet, active)


def build_baseline_payload(repo_root: Path) -> dict[str, object]:
    analysis = analyze_source_size(repo_root)
    if analysis.hard:
        summary = "; ".join(f"{item.path} ({item.rule})" for item in analysis.hard[:12])
        raise ValueError(f"cannot generate a baseline with hard findings: {summary}")
    return {
        "schema": CONFIG_SCHEMA,
        "baseline": [
            {"identity": item.identity, "max_lines": item.lines}
            for item in analysis.soft
        ],
        "exceptions": [],
    }


def _argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Enforce UOK source-size policy.")
    parser.add_argument(
        "--repo-root",
        default=str(Path(__file__).resolve().parents[1]),
    )
    parser.add_argument("--config")
    parser.add_argument("--print-baseline", action="store_true")
    parser.add_argument("--json", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _argument_parser().parse_args(argv)
    root = Path(args.repo_root)
    if args.print_baseline:
        try:
            payload = build_baseline_payload(root)
        except (OSError, ValueError) as exc:
            print(str(exc), file=sys.stderr)
            return 1
    else:
        config = Path(args.config) if args.config else None
        payload = run_source_size_policy(root, config_path=config)
    output = (
        json.dumps(payload, indent=2)
        if args.print_baseline or args.json
        else format_source_size_cli(payload)
    )
    print(output)
    return 0 if args.print_baseline or bool(payload["ok"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
