from __future__ import annotations

import sys
from pathlib import Path

import pytest


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import source_size_rules as rules  # noqa: E402


def _function_source(lines: int) -> str:
    return "\n".join(["def work():", *(["    pass"] * (lines - 1))]) + "\n"


def _analyze_function(
    tmp_path: Path, relative_path: str, lines: int
) -> rules.SourceAnalysis:
    path = tmp_path / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(_function_source(lines), encoding="utf-8")
    return rules.analyze_source_size(tmp_path)


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("tests/example.py", 200),
        ("web/e2e/example.spec.ts", 200),
        ("src/uok/api.py", 200),
        ("src/uok/api/auth.py", 200),
        ("src/uok/router/handlers.py", 200),
        ("modules/demo/backend/routes/handlers.py", 200),
        ("src/uok/order_commands.py", 200),
        ("web/src/shipmentApi.ts", 200),
        ("web/src/shipmentAPI.ts", 200),
        ("web/src/APIClient.ts", 200),
        ("web/src/Example.tsx", 200),
        ("web/src/useExample.ts", 200),
        ("web/src/example.ts", 250),
        ("web/src/capital.ts", 250),
        ("src/uok/api_client.css", 250),
        ("web/src/example.css", 250),
        ("scripts/example.ps1", 250),
        ("migrations/example.sql", 250),
    ],
)
def test_soft_file_classification(path: str, expected: int) -> None:
    assert rules.soft_file_limit(path, Path(path).suffix) == expected


@pytest.mark.parametrize(
    "path",
    [
        "tests/helper.py",
        "modules/demo/verify/runtime.py",
        "modules/demo/verify/runtime/check.py",
    ],
)
def test_test_and_module_verifier_functions_are_exempt_but_files_are_not(
    tmp_path: Path,
    path: str,
) -> None:
    analysis = _analyze_function(tmp_path, path, 251)

    assert all(item.kind != "function" for item in (*analysis.soft, *analysis.hard))
    assert any(
        item.kind == "file" and item.severity == "soft" for item in analysis.soft
    )


@pytest.mark.parametrize(
    "path",
    [
        "scripts/verify_demo.py",
        "scripts/verify/runtime.py",
        "modules/demo/backend/verify_helpers.py",
        "modules/demo/verification/runtime.py",
    ],
)
def test_verify_names_outside_module_verifier_root_do_not_bypass_function_limits(
    tmp_path: Path,
    path: str,
) -> None:
    analysis = _analyze_function(tmp_path, path, 121)

    assert {item.rule for item in analysis.soft} == {"function_soft_60"}
    assert {item.rule for item in analysis.hard} == {"function_hard_120"}
