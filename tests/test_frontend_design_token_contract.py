from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TOKEN_DEFINITION = re.compile(r"(--uok-[a-z0-9-]+)\s*:")
TOKEN_USAGE = re.compile(r"var\((--uok-[a-z0-9-]+)")
RUNTIME_COMPONENT_TOKENS = {"--uok-segment-count"}


def frontend_css_files() -> list[Path]:
    files = set((ROOT / "web" / "src").rglob("*.css"))
    files.update((ROOT / "modules").glob("*/web/src/**/*.css"))
    return sorted(files)


def test_every_uok_css_variable_has_a_definition() -> None:
    files = frontend_css_files()
    definitions: set[str] = set()
    usages: dict[str, set[str]] = {}

    for path in files:
        source = path.read_text(encoding="utf-8")
        definitions.update(TOKEN_DEFINITION.findall(source))
        for token in TOKEN_USAGE.findall(source):
            usages.setdefault(token, set()).add(path.relative_to(ROOT).as_posix())

    unresolved = {
        token: sorted(paths)
        for token, paths in usages.items()
        if token not in definitions and token not in RUNTIME_COMPONENT_TOKENS
    }

    assert not unresolved, (
        "Undefined UOK CSS variables make their declarations invalid: "
        f"{unresolved}"
    )
