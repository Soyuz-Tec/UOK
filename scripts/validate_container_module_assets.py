from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from scripts.frontend_source_policy import is_durable_javascript
except ModuleNotFoundError:  # Direct script execution uses scripts/ as sys.path[0].
    from frontend_source_policy import is_durable_javascript


REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from uok.candidate_verifier_catalog import (  # noqa: E402
    CandidateVerifierCatalogError,
    _is_link_or_junction,
    _safe_verifier_script,
)
from uok.module_contract_validation import validate_module_frontend_contracts  # noqa: E402
from uok.module_manifest_loader import load_module_manifests  # noqa: E402


def validate_container_module_assets(
    module_root: Path,
    *,
    require_tests_excluded: bool,
) -> list[str]:
    if _is_link_or_junction(module_root):
        raise ValueError("module catalog root cannot be a link or junction")
    root = module_root.resolve()
    report = validate_module_frontend_contracts(root)
    problems = [
        f"{row.get('module', 'catalog')}:{row.get('field', 'contract')}: {row.get('reason', row)}"
        for row in report.get("violations", [])
    ]
    manifests = load_module_manifests(root)
    verified: list[str] = []
    for module_name, manifest in manifests.items():
        web_root = _safe_manifest_path(root, module_name, "web_path", manifest["web_path"], problems)
        if web_root is not None and web_root.is_dir():
            _validate_web_assets(module_name, web_root, problems)
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
        test_directories: set[str] = set()
        for module_name, manifest in manifests.items():
            tests_root = _safe_manifest_path(
                root, module_name, "tests_path", manifest["tests_path"], problems
            )
            if tests_root is not None and tests_root.exists():
                test_directories.add(tests_root.relative_to(root.parent).as_posix())
        test_directories.update(
            path.relative_to(root.parent).as_posix()
            for path in root.rglob("*")
            if path.is_dir() and path.name.casefold() in {"tests", "__tests__"}
        )
        test_files = sorted(
            path.relative_to(root.parent).as_posix()
            for path in root.rglob("*")
            if path.is_file() and _is_test_artifact(path.name)
        )
        if test_directories:
            problems.append(
                "container contains manifest-declared module test directories: "
                + ", ".join(sorted(test_directories))
            )
        if test_files:
            problems.append("container contains module test artifacts: " + ", ".join(test_files))
    if problems:
        raise ValueError("; ".join(problems))
    return verified


def _safe_manifest_path(
    module_root: Path,
    module_name: str,
    field: str,
    raw_path: str,
    problems: list[str],
) -> Path | None:
    declared = Path(raw_path)
    expected_prefix = ("modules", module_name)
    if declared.is_absolute() or ".." in declared.parts or declared.parts[:2] != expected_prefix:
        problems.append(f"{module_name}:{field}: path must remain under modules/{module_name}")
        return None
    candidate = module_root.parent / declared
    if candidate.exists() and _is_link_or_junction(candidate):
        problems.append(f"{module_name}:{field}: path cannot be a link or junction")
        return None
    try:
        resolved = candidate.resolve()
        owner_root = (module_root / module_name).resolve()
    except OSError as error:
        problems.append(f"{module_name}:{field}: cannot resolve path: {error}")
        return None
    if not resolved.is_relative_to(owner_root):
        problems.append(f"{module_name}:{field}: resolved path escapes the owning module")
        return None
    return resolved


def _validate_web_assets(module_name: str, web_root: Path, problems: list[str]) -> None:
    for path in sorted(web_root.rglob("*")):
        relative = path.relative_to(web_root)
        if _is_link_or_junction(path):
            problems.append(
                f"{module_name}:web_path: link or junction is not allowed: {relative.as_posix()}"
            )
            continue
        if not path.is_file():
            continue
        lower_name = path.name.casefold()
        if is_durable_javascript(path):
            problems.append(
                f"{module_name}:web_path: durable JavaScript is not allowed: {relative.as_posix()}"
            )
        if _is_test_artifact(lower_name) or "__tests__" in {
            part.casefold() for part in relative.parts
        }:
            problems.append(
                f"{module_name}:web_path: frontend tests must live under tests_path: {relative.as_posix()}"
            )


def _is_test_artifact(name: str) -> bool:
    lower_name = name.casefold()
    return (
        lower_name.startswith("test_")
        or lower_name.endswith("_test.py")
        or ".test." in lower_name
        or ".spec." in lower_name
    )


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
