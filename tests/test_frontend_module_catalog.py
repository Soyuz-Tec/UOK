from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

from generate_frontend_module_catalog import (  # noqa: E402
    OUTPUT_PATH,
    SECTIONS_OUTPUT_PATH,
    ordered_module_names,
    render_frontend_module_catalog,
    render_frontend_module_sections,
)
from tests.module_manifest_contract_support import write_module  # noqa: E402


def test_checked_frontend_catalog_matches_validated_manifests() -> None:
    catalog = OUTPUT_PATH.read_text(encoding="utf-8")
    assert catalog == render_frontend_module_catalog()
    assert SECTIONS_OUTPUT_PATH.read_text(encoding="utf-8") == render_frontend_module_sections()
    assert "../../../modules/intelligence.core/web/src/moduleSurface" in catalog
    assert catalog.index(
        "../../../modules/shipments.core/web/src/moduleSurface"
    ) < catalog.index(
        "../../../modules/intelligence.core/web/src/moduleSurface"
    )


def test_frontend_catalog_is_manifest_driven_and_dependency_ordered(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    write_module(
        module_root,
        "alpha.core",
        dependencies=("beta.core",),
        web_surface="alpha",
    )
    write_module(module_root, "beta.core", web_surface="beta")
    write_module(module_root, "headless.core")

    rendered = render_frontend_module_catalog(module_root)
    sections = render_frontend_module_sections(module_root)

    assert rendered.index("../../../modules/beta.core/web/src/moduleSurface") < rendered.index(
        "../../../modules/alpha.core/web/src/moduleSurface"
    )
    assert 'sectionId: "apps"' in rendered
    assert 'sectionId: "alpha"' in rendered
    assert 'sectionId: "beta"' in rendered
    assert 'export const defaultModuleSection: GeneratedModuleSection = "apps";' in sections
    assert 'export const generatedModuleSections = ["beta", "alpha", "apps"]' in sections
    assert "headless.core/web/src/moduleSurface" not in rendered


def test_dependency_order_is_stable_for_independent_modules() -> None:
    manifests = {
        "zeta.core": {"dependencies": []},
        "alpha.core": {"dependencies": []},
        "middle.core": {"dependencies": ["alpha.core"]},
    }

    assert ordered_module_names(manifests) == ["alpha.core", "middle.core", "zeta.core"]
