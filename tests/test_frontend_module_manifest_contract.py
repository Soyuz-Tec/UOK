from __future__ import annotations

from pathlib import Path

from tests.module_manifest_contract_support import write_module
from uok.module_contract_validation import (
    validate_module_frontend_contracts,
    validate_module_runtime_contracts,
)
from uok.module_manifest_loader import load_module_manifests


def test_repository_frontend_surfaces_are_manifest_owned() -> None:
    manifests = load_module_manifests()
    surfaces = {
        name: (manifest["web_section"], manifest["web_entry"])
        for name, manifest in manifests.items()
        if "web_surface" in manifest["extension_points"]
    }

    assert surfaces == {
        "apps.manager": ("apps", "modules/apps.manager/web/src/moduleSurface.tsx"),
        "calendar.core": ("calendar", "modules/calendar.core/web/src/moduleSurface.tsx"),
        "communications.core": (
            "communications",
            "modules/communications.core/web/src/moduleSurface.tsx",
        ),
        "compliance.core": (
            "compliance",
            "modules/compliance.core/web/src/moduleSurface.tsx",
        ),
        "contacts.core": ("contacts", "modules/contacts.core/web/src/moduleSurface.tsx"),
        "locations.core": ("locations", "modules/locations.core/web/src/moduleSurface.tsx"),
        "planning.core": ("planning", "modules/planning.core/web/src/moduleSurface.tsx"),
        "product.master": ("products", "modules/product.master/web/src/moduleSurface.tsx"),
        "routes.core": ("routes", "modules/routes.core/web/src/moduleSurface.tsx"),
        "shipments.core": (
            "shipments",
            "modules/shipments.core/web/src/moduleSurface.tsx",
        ),
    }
    assert manifests["planning.core"]["dependencies"] == ["calendar.core"]
    assert manifests["routes.core"]["dependencies"] == ["locations.core"]
    assert manifests["shipments.core"]["dependencies"] == [
        "contacts.core",
        "locations.core",
        "routes.core",
    ]


def test_runtime_contract_rejects_invalid_frontend_surface_assets(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    write_module(module_root, "alpha.core", web_surface="overview")
    (module_root / "alpha.core" / "web" / "src" / "moduleSurface.tsx").unlink()

    report = validate_module_frontend_contracts(module_root)
    reasons = "\n".join(row["reason"] for row in report["violations"])

    assert report["ok"] is False
    assert "web_section overview is reserved by the shell" in reasons
    assert "declared web entry does not exist" in reasons


def test_runtime_contract_rejects_duplicate_frontend_sections(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    write_module(module_root, "alpha.core", web_surface="workspace")
    write_module(module_root, "beta.core", web_surface="workspace")

    report = validate_module_runtime_contracts(module_root)

    assert any(
        row["field"] == "web_section"
        and row["reason"] == "web section workspace is already owned by alpha.core"
        for row in report["violations"]
    )


def test_runtime_contract_requires_canonical_frontend_entry(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    manifest = module_root / "apps.manager" / "manifest.yaml"
    manifest.write_text(
        manifest.read_text(encoding="utf-8").replace(
            "modules/apps.manager/web/src/moduleSurface.tsx",
            "modules/apps.manager/web/src/other.tsx",
        ),
        encoding="utf-8",
    )

    report = validate_module_runtime_contracts(module_root)

    assert any(
        row["field"] == "web_entry"
        and "web_entry must be exactly" in row["reason"]
        for row in report["violations"]
    )


def test_runtime_contract_does_not_require_frontend_source_assets(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    (module_root / "apps.manager" / "web" / "src" / "moduleSurface.tsx").unlink()

    runtime = validate_module_runtime_contracts(module_root)
    frontend = validate_module_frontend_contracts(module_root)

    assert runtime["ok"] is True, runtime["violations"]
    assert frontend["ok"] is False
    assert any(row["field"] == "web_entry" for row in frontend["violations"])


def test_frontend_contract_rejects_platform_specific_path_spellings(tmp_path: Path) -> None:
    module_root = tmp_path / "modules"
    write_module(module_root, "apps.manager", required=True, web_surface="apps")
    manifest = module_root / "apps.manager" / "manifest.yaml"
    text = manifest.read_text(encoding="utf-8")
    text = text.replace(
        "web_path: modules/apps.manager/web",
        r"web_path: modules\apps.manager\web",
    ).replace(
        "web_entry: modules/apps.manager/web/src/moduleSurface.tsx",
        "web_entry: modules/apps.manager/web/./src/moduleSurface.tsx",
    )
    manifest.write_text(text, encoding="utf-8")

    report = validate_module_frontend_contracts(module_root)

    fields = {row["field"] for row in report["violations"]}
    assert {"web_path", "web_entry"}.issubset(fields)
