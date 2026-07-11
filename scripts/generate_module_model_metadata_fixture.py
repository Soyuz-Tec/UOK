from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
for path in (ROOT, SRC):
    value = str(path)
    if value not in sys.path:
        sys.path.insert(0, value)

from tests.model_metadata_contract import normalized_model_metadata  # noqa: E402
from uok.module_model_registry import ensure_module_models_registered  # noqa: E402


OUTPUT = ROOT / "tests" / "fixtures" / "module_model_metadata.json"


def main() -> None:
    payload = normalized_model_metadata(ensure_module_models_registered())
    entries = list(sorted(payload.items()))
    lines = ["{"]
    for index, (name, signature) in enumerate(entries):
        comma = "," if index + 1 < len(entries) else ""
        lines.append(
            f"  {json.dumps(name)}: "
            f"{json.dumps(signature, sort_keys=True, separators=(',', ':'))}{comma}"
        )
    lines.append("}")
    OUTPUT.write_text(
        "\n".join(lines) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {len(payload)} model metadata signatures to {OUTPUT}")


if __name__ == "__main__":
    main()
