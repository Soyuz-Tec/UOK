from __future__ import annotations

import sys
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import documentation_reference_policy  # noqa: E402


ROOT = Path(__file__).resolve().parents[1]


def test_active_documentation_references_resolve() -> None:
    assert documentation_reference_policy.documentation_reference_problems(ROOT) == []


def test_missing_inline_repository_reference_is_reported(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    policy = docs / "POLICY.md"
    policy.write_text("Use `scripts/missing.py`.\n", encoding="utf-8")

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: missing repository reference scripts/missing.py"
    ]


def test_templates_and_fenced_target_shapes_are_not_current_references(
    tmp_path: Path,
) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text(
        "Use `modules/<module_name>/web/src`.\n\n"
        "```text\n"
        "scripts/future_target.py\n"
        "```\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == []


def test_missing_internal_link_and_index_route_are_reported(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "DOCUMENTATION_INDEX.md").write_text("# Index\n", encoding="utf-8")
    (docs / "POLICY.md").write_text(
        "Read [the missing guide](../guides/missing.md).\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: missing internal link target ../guides/missing.md",
        "docs/DOCUMENTATION_INDEX.md: missing documentation route docs/POLICY.md",
    ]


def test_retired_module_frontend_reference_is_reported(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text(
        "Planning lives in `web/src/features/planning`.\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: retired frontend reference web/src/features/planning",
        "docs/POLICY.md:1: missing repository reference web/src/features/planning",
    ]


def test_filesystem_fallback_works_without_git(
    tmp_path: Path,
    monkeypatch,
) -> None:
    scripts = tmp_path / "scripts"
    scripts.mkdir()
    (scripts / "present.py").write_text("", encoding="utf-8")
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text("Use `scripts/present.py`.\n", encoding="utf-8")
    monkeypatch.setattr(
        documentation_reference_policy.subprocess,
        "run",
        lambda *args, **kwargs: (_ for _ in ()).throw(FileNotFoundError()),
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == []


def test_tracked_but_deleted_reference_is_reported(
    tmp_path: Path,
    monkeypatch,
) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text("Use `scripts/deleted.py`.\n", encoding="utf-8")
    monkeypatch.setattr(
        documentation_reference_policy,
        "_tracked_paths",
        lambda repo_root: frozenset({"scripts/deleted.py"}),
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: missing repository reference scripts/deleted.py"
    ]


def test_retired_frontend_reference_is_rejected_inside_command_fence(
    tmp_path: Path,
) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text(
        "```powershell\n"
        "npm --prefix web test -- --run src/features/planning/planningApi.test.ts\n"
        "```\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:2: retired frontend reference src/features/planning"
    ]


def test_internal_link_requires_exact_case(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "Guide.md").write_text("# Guide\n", encoding="utf-8")
    (docs / "POLICY.md").write_text(
        "Read [the guide](guide.md).\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: missing internal link target guide.md"
    ]


def test_empty_tracked_directory_does_not_prove_deleted_descendant(
    tmp_path: Path,
    monkeypatch,
) -> None:
    legacy = tmp_path / "scripts" / "legacy"
    legacy.mkdir(parents=True)
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text("Use `scripts/legacy`.\n", encoding="utf-8")
    monkeypatch.setattr(
        documentation_reference_policy,
        "_tracked_paths",
        lambda repo_root: frozenset({"scripts/legacy/deleted.py"}),
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: missing repository reference scripts/legacy"
    ]


def test_canonical_module_paths_do_not_match_retired_relative_paths(tmp_path: Path) -> None:
    contacts = tmp_path / "modules" / "contacts.core" / "web" / "src" / "app"
    contacts.mkdir(parents=True)
    (contacts / "useContactCommands.ts").write_text("", encoding="utf-8")
    apps_styles = tmp_path / "modules" / "apps.manager" / "web" / "src" / "styles"
    apps_styles.mkdir(parents=True)
    (apps_styles / "apps-manager.css").write_text("", encoding="utf-8")
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text(
        "Use `modules/contacts.core/web/src/app/useContactCommands.ts` and "
        "`modules/apps.manager/web/src/styles/apps-manager.css`.\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == []


def test_retired_paths_reject_relative_and_windows_spellings(tmp_path: Path) -> None:
    docs = tmp_path / "docs"
    docs.mkdir()
    (docs / "POLICY.md").write_text(
        "Use ./src/features/planning/planningApi.test.ts.\n"
        "Do not use .\\web\\src\\features\\planning\\planningApi.test.ts.\n",
        encoding="utf-8",
    )

    assert documentation_reference_policy.documentation_reference_problems(tmp_path) == [
        "docs/POLICY.md:1: retired frontend reference src/features/planning",
        "docs/POLICY.md:2: retired frontend reference web/src/features/planning",
    ]
