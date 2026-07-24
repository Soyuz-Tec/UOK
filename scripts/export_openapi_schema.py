from __future__ import annotations

from check_generated_contracts import OPENAPI_PATH, render_runtime_openapi


OPENAPI_PATH.parent.mkdir(parents=True, exist_ok=True)
OPENAPI_PATH.write_text(render_runtime_openapi(), encoding="utf-8")
print(OPENAPI_PATH)
