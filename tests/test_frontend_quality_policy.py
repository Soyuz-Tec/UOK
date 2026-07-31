from __future__ import annotations

import json
import sys
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from frontend_quality_policy import _frontend_tooling_problems  # noqa: E402


def _write_frontend_tooling_fixture(repo_root: Path) -> dict[str, object]:
    artifacts = (
        "eslint.config.mjs",
        "web/eslint.config.mjs",
        "web/stylelint.config.mjs",
        "web/scripts/run-eslint.mjs",
        "web/scripts/check-bundle-budget.mjs",
        "web/scripts/check-dependency-policy.mjs",
    )
    for relative in artifacts:
        path = repo_root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("export default {};\n", encoding="utf-8")

    package: dict[str, object] = {
        "scripts": {
            "lint": "node scripts/run-eslint.mjs",
            "lint:styles": 'stylelint "src/**/*.css" "../modules/*/web/src/**/*.css"',
            "check:bundle-budget": "node scripts/check-bundle-budget.mjs",
            "check:dependencies": "node scripts/check-dependency-policy.mjs",
        }
    }
    package_path = repo_root / "web" / "package.json"
    package_path.write_text(json.dumps(package), encoding="utf-8")

    workflow = repo_root / ".github" / "workflows" / "uok-ci.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text(
        "\n".join(
            (
                "run: npm run check:dependencies",
                "run: npm run lint",
                "run: npm run lint:styles",
                "run: npm run build:static",
                "run: npm run check:bundle-budget",
            )
        ),
        encoding="utf-8",
    )
    return package


def test_frontend_tooling_policy_accepts_complete_contract(tmp_path: Path) -> None:
    package = _write_frontend_tooling_fixture(tmp_path)

    assert _frontend_tooling_problems(tmp_path, package) == []


def test_frontend_tooling_policy_reports_missing_contract_parts(
    tmp_path: Path,
) -> None:
    package = _write_frontend_tooling_fixture(tmp_path)
    (tmp_path / "web" / "stylelint.config.mjs").unlink()
    scripts = package["scripts"]
    assert isinstance(scripts, dict)
    scripts.pop("lint")
    workflow = tmp_path / ".github" / "workflows" / "uok-ci.yml"
    workflow.write_text(
        workflow.read_text(encoding="utf-8").replace(
            "run: npm run check:dependencies\n", ""
        ),
        encoding="utf-8",
    )

    problems = _frontend_tooling_problems(tmp_path, package)

    assert "frontend tooling artifact missing: web/stylelint.config.mjs" in problems
    assert "frontend lint script must be node scripts/run-eslint.mjs" in problems
    assert (
        "frontend protected CI command missing: npm run check:dependencies" in problems
    )


def test_frontend_tooling_policy_requires_budget_after_build(tmp_path: Path) -> None:
    package = _write_frontend_tooling_fixture(tmp_path)
    workflow = tmp_path / ".github" / "workflows" / "uok-ci.yml"
    text = workflow.read_text(encoding="utf-8")
    workflow.write_text(
        text.replace(
            "run: npm run build:static\nrun: npm run check:bundle-budget",
            "run: npm run check:bundle-budget\nrun: npm run build:static",
        ),
        encoding="utf-8",
    )

    assert (
        "frontend bundle budget CI gate must run after the build"
        in _frontend_tooling_problems(tmp_path, package)
    )
