from __future__ import annotations

import sys
from pathlib import Path


SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from frontend_source_policy import is_durable_javascript  # noqa: E402
from frontend_quality_policy import _safe_module_web_root  # noqa: E402


def test_durable_javascript_policy_covers_script_module_variants() -> None:
    for name in ("legacy.js", "legacy.jsx", "legacy.mjs", "legacy.cjs"):
        assert is_durable_javascript(Path(name)) is True
    for name in ("feature.ts", "feature.tsx", "styles.css"):
        assert is_durable_javascript(Path(name)) is False


def test_quality_scan_confines_manifest_web_paths_to_the_owner(tmp_path: Path) -> None:
    owned = tmp_path / "modules" / "alpha.core" / "web"
    owned.mkdir(parents=True)

    safe, problem = _safe_module_web_root(
        tmp_path, "alpha.core", "modules/alpha.core/web"
    )
    assert safe == owned.resolve()
    assert problem is None

    for unsafe in (
        "../outside",
        str((tmp_path / "outside").resolve()),
        r"modules\alpha.core\web",
        "modules/beta.core/web",
    ):
        safe, problem = _safe_module_web_root(tmp_path, "alpha.core", unsafe)
        assert safe is None
        assert problem is not None
