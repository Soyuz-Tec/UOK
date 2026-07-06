from __future__ import annotations

from pathlib import Path


def test_uok_naming_discipline_has_no_retired_names() -> None:
    root = Path(__file__).resolve().parents[1]
    ignored_parts = {".pytest_cache", "__pycache__", "node_modules", "data"}
    checked_suffixes = {".py", ".ps1", ".toml", ".md", ".yml", ".yaml", ".json", ".tsx", ".ts", ".css", ".html", ".sql"}
    forbidden = [
        "".join(map(chr, [99, 108, 101, 97, 110, 114, 111, 111, 109])),
        "".join(map(chr, [99, 108, 101, 97, 110, 45, 114, 111, 111, 109])),
        "".join(map(chr, [99, 108, 101, 97, 110, 95, 114, 111, 111, 109])),
        "".join(map(chr, [117, 111, 107, 114, 111, 111, 109])),
        "".join(map(chr, [117, 111, 107, 95, 99, 108, 101, 97, 110])),
        "".join(map(chr, [117, 111, 107, 95, 107, 101, 114, 110, 101, 108])),
        "".join(map(chr, [117, 111, 107, 45, 107, 101, 114, 110, 101, 108])),
        "".join(map(chr, [85, 79, 75, 32, 75, 101, 114, 110, 101, 108])),
        "".join(map(chr, [85, 79, 75, 32, 107, 101, 114, 110, 101, 108])),
        "".join(map(chr, [85, 110, 105, 102, 105, 101, 100, 32, 79, 112, 101, 114, 97, 116, 105, 111, 110, 115, 32, 75, 101, 114, 110, 101, 108])),
        "".join(map(chr, [85, 79, 75, 32, 67, 108, 101, 97, 110])),
    ]
    findings: list[str] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix not in checked_suffixes:
            continue
        if any(part in ignored_parts for part in path.relative_to(root).parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        lowered = text.lower()
        for phrase in forbidden:
            haystack = lowered if phrase.islower() else text
            needle = phrase if not phrase.islower() else phrase.lower()
            if needle in haystack:
                findings.append(f"{path.relative_to(root).as_posix()}: {phrase}")
    assert findings == []
