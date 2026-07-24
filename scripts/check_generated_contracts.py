from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from generate_frontend_module_catalog import (
    OUTPUT_PATH as MODULE_CATALOG_PATH,
    SECTIONS_OUTPUT_PATH as MODULE_SECTIONS_PATH,
    render_frontend_module_catalog,
    render_frontend_module_sections,
)


ROOT = Path(__file__).resolve().parents[1]
WEB_ROOT = ROOT / "web"
GENERATED_ROOT = WEB_ROOT / "src" / "generated"
OPENAPI_PATH = GENERATED_ROOT / "openapi.json"
TYPES_PATH = GENERATED_ROOT / "openapi.d.ts"


def render_runtime_openapi() -> str:
    # Contract rendering must never bootstrap or mutate the configured database,
    # even when the caller's shell enables bootstrap for a local runtime.
    os.environ["UOK_BOOTSTRAP_ON_IMPORT"] = "0"
    os.environ.setdefault("DATABASE_URL", "sqlite:///./data/openapi-uok.db")
    os.environ.setdefault("DATA_DIR", "./data")
    sys.path.insert(0, str(ROOT / "src"))

    from uok.host.application import app

    return json.dumps(app.openapi(), indent=2, sort_keys=True)


def generate_typescript_contract(openapi_path: Path, output_path: Path) -> None:
    node = shutil.which("node")
    generator = WEB_ROOT / "node_modules" / "openapi-typescript" / "bin" / "cli.js"
    if node is None:
        raise RuntimeError("Node.js is required to check the generated TypeScript contract")
    if not generator.is_file():
        raise RuntimeError(
            "installed openapi-typescript is required; run npm --prefix web ci before checking contracts"
        )
    completed = subprocess.run(
        [
            node,
            str(generator),
            str(openapi_path),
            "-o",
            str(output_path),
        ],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        details = completed.stderr.strip() or completed.stdout.strip()
        raise RuntimeError(f"openapi-typescript failed: {details}")


def contract_drift(expected: str, checked_path: Path) -> str | None:
    try:
        display_path = checked_path.relative_to(ROOT).as_posix()
    except ValueError:
        display_path = checked_path.as_posix()
    if not checked_path.exists():
        return f"missing generated contract: {display_path}"
    checked = checked_path.read_text(encoding="utf-8")
    if checked == expected:
        return None
    expected_hash = hashlib.sha256(expected.encode("utf-8")).hexdigest()[:12]
    checked_hash = hashlib.sha256(checked.encode("utf-8")).hexdigest()[:12]
    return f"{display_path} drifted (expected sha256:{expected_hash}, checked-in sha256:{checked_hash})"


def find_generated_contract_drift() -> list[str]:
    runtime_openapi = render_runtime_openapi()
    problems: list[str] = []
    openapi_problem = contract_drift(runtime_openapi, OPENAPI_PATH)
    if openapi_problem:
        problems.append(openapi_problem)
    module_catalog_problem = contract_drift(
        render_frontend_module_catalog(), MODULE_CATALOG_PATH
    )
    if module_catalog_problem:
        problems.append(module_catalog_problem)
    module_sections_problem = contract_drift(
        render_frontend_module_sections(), MODULE_SECTIONS_PATH
    )
    if module_sections_problem:
        problems.append(module_sections_problem)

    with tempfile.TemporaryDirectory(prefix="uok-generated-contracts-") as temporary:
        temp_root = Path(temporary)
        temp_openapi = temp_root / "openapi.json"
        temp_types = temp_root / "openapi.d.ts"
        temp_openapi.write_text(runtime_openapi, encoding="utf-8")
        generate_typescript_contract(temp_openapi, temp_types)
        types_problem = contract_drift(temp_types.read_text(encoding="utf-8"), TYPES_PATH)
        if types_problem:
            problems.append(types_problem)
    return problems


def main() -> int:
    try:
        problems = find_generated_contract_drift()
    except (RuntimeError, ValueError) as error:
        print(f"Generated contract check failed: {error}", file=sys.stderr)
        return 1
    if problems:
        print("Generated contracts are stale:", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        print("Run: npm --prefix web run generate:api && npm --prefix web run generate:modules", file=sys.stderr)
        return 1
    print("Generated OpenAPI, TypeScript declarations, and frontend module catalog match runtime contracts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
