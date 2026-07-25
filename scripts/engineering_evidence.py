from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import engineering_measurements
import quality_audit
import quality_scorecard
import source_size_policy


REPO_ROOT = Path(__file__).resolve().parents[1]
GUARDRAIL_PATHS = (
    "AGENTS.md",
    "CODE_OF_CONDUCT.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "SECURITY.md",
    "SUPPORT.md",
    ".github/CODEOWNERS",
    ".github/copilot-instructions.md",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/workflows/uok-ci.yml",
    ".github/workflows/uok-openssf-scorecard.yml",
    "docs/ARCHITECTURE.md",
    "docs/DOCUMENTATION_INDEX.md",
    "docs/architecture/UOK_INTERNAL_ENGINEERING_SYSTEM.md",
    "docs/architecture/UOK_CODE_QUALITY_AND_TECHNOLOGY_AUDIT_STANDARD.md",
    "docs/operations/UOK_STANDARD_OPERATIONS.md",
    "docs/operations/UOK_GITHUB_ENGINEERING_GUARDRAILS.md",
    "scripts/quality_audit.py",
    "scripts/quality_scorecard.py",
    "scripts/quality_scorecard_contract.py",
    "scripts/quality_scorecard_source_size.py",
    "scripts/engineering_coverage.py",
    "scripts/engineering_artifact_validation.py",
    "scripts/coverage_corroboration.py",
    "scripts/coverage_provenance.py",
    "scripts/coverage_provenance_artifacts.py",
    "scripts/coverage_provenance_validation.py",
    "scripts/coverage_run_directory.py",
    "scripts/coverage_run_binding.py",
    "scripts/engineering_measurements.py",
    "scripts/build_engineering_measurements.py",
    "scripts/python_test_cli.py",
    "scripts/community_health_policy.py",
    "scripts/source_size_policy.py",
    "scripts/source_size_configuration.py",
    "scripts/source_size_configuration_types.py",
    "scripts/source_size_configuration_validation.py",
    "scripts/source_size_discovery.py",
    "scripts/source_size_models.py",
    "scripts/source_size_python.py",
    "scripts/source_size_ratchet.py",
    "scripts/source_size_reporting.py",
    "scripts/source_size_rules.py",
    "scripts/uok_repository_quality_ops.ps1",
    "scripts/uok_toolchain_versions.ps1",
    "scripts/uok_toolchain_preflight.ps1",
    "config/source_size_policy.json",
    "scripts/database_security_evaluation_checks.py",
    "scripts/database_security_evaluation_rules.py",
    "scripts/uok_release_evidence_artifacts.py",
    "docs/governance/UOK_ENGINEERING_EVIDENCE_V2_MIGRATION.md",
)


def run_git(args: list[str]) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip()


def file_sha256(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def file_record(relative_path: str) -> dict[str, Any]:
    path = REPO_ROOT / relative_path
    if not path.exists():
        return {"path": relative_path, "exists": False}
    return {
        "path": relative_path,
        "exists": True,
        "sha256": file_sha256(path),
        "bytes": path.stat().st_size,
    }


def quality_report() -> dict[str, Any]:
    results = quality_audit.run_checks()
    return {
        "ok": all(result.ok for result in results),
        "checks": [result.__dict__ for result in results],
    }


def source_size_report() -> dict[str, Any]:
    return source_size_policy.run_source_size_policy(REPO_ROOT)


def module_manifest_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for manifest in sorted((REPO_ROOT / "modules").glob("*/manifest.yaml")):
        module_root = manifest.parent
        records.append(
            {
                "module": module_root.name,
                "manifest": file_record(str(manifest.relative_to(REPO_ROOT))),
                "folders": {
                    folder: (module_root / folder).is_dir()
                    for folder in ("backend", "web", "migrations", "tests")
                },
            }
        )
    return records


def load_measurements(
    path: Path,
    repo_root: Path = REPO_ROOT,
) -> dict[str, Any]:
    return engineering_measurements.load_measurements(path, repo_root)


def build_evidence(measurements: dict[str, Any] | None = None) -> dict[str, Any]:
    status_lines = run_git(["status", "--short"]).splitlines()
    quality = quality_report()
    source_size = source_size_report()
    scorecard = quality_scorecard.build_scorecard(
        quality,
        source_size_report=source_size,
        measurements=measurements,
        measurement_repo_root=REPO_ROOT,
    )
    return {
        "schema": "uok.engineering_evidence.v2",
        "schema_compatibility": {
            "previous_schema": "uok.engineering_evidence.v1",
            "migration": ("docs/governance/UOK_ENGINEERING_EVIDENCE_V2_MIGRATION.md"),
        },
        "evidence_scope": {
            "kind": "repository_conformance",
            "not_a_maturity_rating": True,
            "not_production_readiness_proof": True,
        },
        "created_at": datetime.now(UTC).isoformat(),
        "git": {
            "branch": run_git(["branch", "--show-current"]),
            "head": run_git(["rev-parse", "HEAD"]),
            "remote_origin": run_git(["remote", "get-url", "origin"]),
            "dirty_file_count": len(status_lines),
        },
        "quality_audit": quality,
        "quality_scorecard": scorecard,
        "repository_conformance": scorecard["repository_conformance"],
        "measurements": scorecard["measurement_evidence"],
        "trend_metrics": scorecard["trend_metrics"],
        "source_size_policy": source_size,
        "guardrail_files": [file_record(path) for path in GUARDRAIL_PATHS],
        "module_manifests": module_manifest_records(),
    }


def default_output_path() -> Path:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    return (
        REPO_ROOT / "var" / "evidence" / "engineering" / f"uok_engineering_{stamp}.json"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate UOK engineering evidence.")
    parser.add_argument(
        "--stdout", action="store_true", help="Print evidence without writing a file."
    )
    parser.add_argument("--output", help="Write evidence to this path.")
    parser.add_argument(
        "--measurements",
        help=(
            "Read optional measured category evidence using the "
            f"{quality_scorecard.MEASUREMENT_SCHEMA} schema."
        ),
    )
    args = parser.parse_args()

    measurements = None
    if args.measurements:
        measurement_path = Path(args.measurements)
        if not measurement_path.is_absolute():
            measurement_path = REPO_ROOT / measurement_path
        try:
            measurements = load_measurements(measurement_path)
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            parser.error(str(exc))

    evidence = build_evidence(measurements)
    rendered = json.dumps(evidence, indent=2)
    if args.stdout:
        print(rendered)
        return 0

    output = Path(args.output) if args.output else default_output_path()
    if not output.is_absolute():
        output = REPO_ROOT / output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(rendered + "\n", encoding="utf-8")
    print(output)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
