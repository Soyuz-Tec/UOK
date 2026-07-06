from __future__ import annotations

import json
import os
import sys
from pathlib import Path

os.environ.setdefault("UOK_BOOTSTRAP_ON_IMPORT", "0")
os.environ.setdefault("DATABASE_URL", "sqlite:///./data/openapi-uok.db")
os.environ.setdefault("DATA_DIR", "./data")

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
OUT = ROOT / "web" / "src" / "generated" / "openapi.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

from uok.main import app  # noqa: E402

OUT.write_text(json.dumps(app.openapi(), indent=2, sort_keys=True), encoding="utf-8")
print(OUT)
