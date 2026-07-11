from __future__ import annotations

import argparse
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from uok.candidate_verifier_catalog import (  # noqa: E402
    CandidateVerifierCatalogError,
    _is_link_or_junction,
    _safe_verifier_script,
)
from uok.module_contract_validation import validate_module_runtime_contracts  # noqa: E402
from uok.module_manifest_loader import load_module_manifests  # noqa: E402


def validate_container_module_assets(
    module_root: Path,
    *,
    require_tests_excluded: bool,
) -> list[str]:
    if _is_link_or_junction(module_root):
        raise ValueError("module catalog root cannot be a link or junction")
    root = module_root.resolve()
    report = validate_module_runtime_contracts(root)
    problems = [
        f"{row.get('module', 'catalog')}:{row.get('field', 'contract')}: {row.get('reason', row)}"
        for row in report.get("violations", [])
    ]
    manifests = load_module_manifests(root)
    verified: list[str] = []
    for module_name, manifest in manifests.items():
        if manifest.get("maturity") != "runtime_proven":
            continue
        if "candidate_verifier" not in manifest.get("extension_points", []):
            problems.append(f"{module_name}: runtime-proven module has no candidate_verifier extension")
            continue
        try:
            verified.append(
                _safe_verifier_script(
                    root.parent,
                    module_name,
                    str(manifest.get("candidate_verifier_script", "")),
                )
            )
        except CandidateVerifierCatalogError as error:
            problems.append(str(error))
    if require_tests_excluded:
        test_directories = sorted(
            path.relative_to(root.parent).as_posix()
            for path in root.rglob("tests")
            if path.is_dir()
        )
        if test_directories:
            problems.append("container contains module test directories: " + ", ".join(test_directories))
    if problems:
        raise ValueError("; ".join(problems))
    return verified


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate manifest-declared container module assets.")
    parser.add_argument("--module-root", type=Path, default=REPO_ROOT / "modules")
    parser.add_argument("--require-tests-excluded", action="store_true")
    args = parser.parse_args()
    try:
        verified = validate_container_module_assets(
            args.module_root,
            require_tests_excluded=args.require_tests_excluded,
        )
    except ValueError as error:
        print(f"Container module asset validation failed: {error}", file=sys.stderr)
        return 1
    print(f"Validated {len(verified)} runtime-proven module verifier assets.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
