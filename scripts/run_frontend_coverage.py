from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

import coverage_provenance
from engineering_coverage import MeasurementValidationError


REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = REPO_ROOT / "web"
VITEST_ENTRYPOINT = WEB_ROOT / "node_modules" / "vitest" / "vitest.mjs"


def main() -> int:
    node = shutil.which("node")
    if not node or not VITEST_ENTRYPOINT.is_file():
        print("Node.js or the pinned Vitest entrypoint is unavailable.", file=sys.stderr)
        return 2
    try:
        coverage_run = coverage_provenance.begin_coverage_run(
            REPO_ROOT,
            "frontend",
        )
        environment = os.environ.copy()
        environment["UOK_FRONTEND_COVERAGE_OUTPUT_DIRECTORY"] = str(
            (REPO_ROOT / coverage_run.output_directory).resolve()
        )
        result = subprocess.run(
            [
                node,
                str(VITEST_ENTRYPOINT),
                "run",
                "--config",
                "vitest.coverage.config.ts",
                "--coverage",
            ],
            cwd=WEB_ROOT,
            env=environment,
            check=False,
        )
        if result.returncode:
            return result.returncode
        coverage_provenance.bind_coverage_run_artifacts(
            REPO_ROOT,
            coverage_run,
        )
        provenance = coverage_provenance.seal_coverage_run(
            REPO_ROOT,
            coverage_run,
        )
    except MeasurementValidationError as error:
        print(f"Frontend coverage provenance failed: {error}", file=sys.stderr)
        return 2
    finally:
        if "coverage_run" in locals():
            coverage_provenance.discard_coverage_run(REPO_ROOT, coverage_run)
    if provenance is None:
        print("Coverage passed; clean-HEAD provenance was not sealed for a dirty tree.")
    else:
        print(f"Coverage provenance written to {provenance}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
