from __future__ import annotations

from pathlib import Path

from uok.module_manifest_loader import load_module_manifests
from uok.module_paths import ensure_module_backend_paths, modules_root
from uok.modules import module_contracts


def test_file_backed_module_manifests_define_baseline_catalog() -> None:
    root = modules_root()
    manifests = load_module_manifests(root)

    assert sorted(manifests) == ["apps.manager", "contacts.core"]
    for module_name in manifests:
        module_dir = root / module_name
        assert (module_dir / "manifest.yaml").is_file()
        assert (module_dir / "backend").is_dir()
        assert (module_dir / "web").is_dir()
        assert (module_dir / "migrations").is_dir()
        assert (module_dir / "tests").is_dir()

    assert manifests["apps.manager"]["required"] is True
    assert manifests["contacts.core"]["required"] is False
    assert "CreateContact" in manifests["contacts.core"]["commands"]
    assert "ContactCreated" in manifests["contacts.core"]["events"]
    assert manifests["contacts.core"]["backend_path"] == "modules/contacts.core/backend"
    assert "/api/contacts" in manifests["contacts.core"]["api_prefixes"]
    assert "contacts.manage" in manifests["contacts.core"]["permissions"]


def test_contacts_core_backend_loads_from_physical_module_root() -> None:
    ensure_module_backend_paths()

    import uok_contacts_core
    from uok import contacts

    backend_file = Path(uok_contacts_core.__file__).resolve()
    assert "modules" in backend_file.parts
    assert "contacts.core" in backend_file.parts
    assert contacts.clean_text(" UOK ") == "UOK"


def test_module_extension_contract_is_enforced() -> None:
    contracts = module_contracts()

    assert contracts["ok"] is True
    extension_contract = contracts["extension_contract"]
    assert extension_contract["ok"] is True
    assert extension_contract["checks"]["required_modules"] == ["apps.manager"]
    assert extension_contract["checks"]["all_paths_module_scoped"] is True
    assert extension_contract["violations"] == []
