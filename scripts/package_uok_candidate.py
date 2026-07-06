from __future__ import annotations

import argparse
import datetime as dt
import zipfile
from pathlib import Path

EXCLUDE_DIRS = {".git", ".pytest_cache", ".venv", "__pycache__", "coverage", "data", "dist", "htmlcov", "node_modules"}
EXCLUDE_FILENAMES = {".env"}
EXCLUDE_SUFFIXES = {".db", ".pyc", ".pyo", ".sqlite", ".sqlite3", ".tsbuildinfo"}


def should_include(path: Path, root: Path) -> bool:
    rel = path.relative_to(root)
    if any(part in EXCLUDE_DIRS for part in rel.parts):
        return False
    if path.name in EXCLUDE_FILENAMES:
        return False
    if path.suffix in EXCLUDE_SUFFIXES:
        return False
    if path.name.endswith(".zip"):
        return False
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", default="3.1.0-alpha.3")
    parser.add_argument("--output-directory", default="..")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    out = (root / args.output_directory).resolve()
    out.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    package = out / f"UOK_v{args.version}_local_candidate_{stamp}.zip"
    with zipfile.ZipFile(package, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file() and should_include(path, root):
                zf.write(path, path.relative_to(root).as_posix())
    print(package)


if __name__ == "__main__":
    main()
