from __future__ import annotations

import ast

from starlette.testclient import TestClient

from tests.helpers import auth
from uok.module_paths import repo_root


def test_catalog_exposes_runtime_status_and_manifest_maturity(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")

    response = client.get("/api/modules/catalog", headers=admin)

    assert response.status_code == 200, response.text
    modules = response.json()["modules"]
    assert modules["apps.manager"]["status"] == "installed"
    assert modules["apps.manager"]["maturity"] == "runtime_proven"
    assert modules["apps.manager"]["lifecycle_state_declared"] is True
    assert modules["agents.core"] == {
        **modules["agents.core"],
        "status": "planned",
        "maturity": "planned",
        "installable": False,
        "updatable": False,
        "maintainable": False,
        "lifecycle": ["planned"],
        "lifecycle_state_declared": True,
    }


def test_generic_lifecycle_report_has_no_module_specific_checks(client: TestClient) -> None:
    viewer = auth(client, "viewer", "viewer123")

    response = client.get("/api/modules/lifecycle", headers=viewer)

    assert response.status_code == 200, response.text
    report = response.json()
    assert report["ok"] is True
    assert all(report["checks"].values())
    assert set(report["checks"]) == {
        "catalog_declared",
        "dependencies_declared",
        "installable_modules_lifecycle_ready",
        "lifecycle_flags_boolean",
        "lifecycle_states_valid",
        "maturity_values_valid",
        "optional_modules_default_ready",
        "planned_modules_inert",
        "required_modules_bootstrap_ready",
        "required_modules_protected",
        "uninstallable_modules_lifecycle_ready",
        "updatable_modules_lifecycle_ready",
    }
    assert report["module_checks"]["agents.core"]["planned_modules_inert"] is True


def test_planned_module_lifecycle_actions_fail_closed(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    viewer = auth(client, "viewer", "viewer123")

    denied = client.post("/api/modules/agents.core/install", headers=viewer)
    assert denied.status_code == 403, denied.text

    install = client.post("/api/modules/agents.core/install", headers=admin)
    assert install.status_code == 400, install.text
    assert "planned module cannot be installed" in install.text

    upgrade = client.post("/api/modules/agents.core/upgrade", headers=admin)
    assert upgrade.status_code == 400, upgrade.text
    assert "planned module cannot be upgraded" in upgrade.text

    maintenance = client.get("/api/modules/agents.core/maintenance", headers=admin)
    assert maintenance.status_code == 400, maintenance.text
    assert "module is not maintainable" in maintenance.text


def test_maintenance_negative_invariant_does_not_make_report_fail(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")

    response = client.get("/api/modules/apps.manager/maintenance", headers=admin)

    assert response.status_code == 200, response.text
    report = response.json()
    assert report["ok"] is True
    assert report["checks"]["uok_compromise_required"] is False
    assert report["operations_safe_for_uok"] is True


def test_apps_manager_router_is_not_hardcoded_in_kernel_composition() -> None:
    main_source = (repo_root() / "src" / "uok" / "main.py").read_text(encoding="utf-8")
    legacy_router = repo_root() / "src" / "uok" / "api" / "modules.py"

    assert "modules_router" not in main_source
    assert "api.modules" not in main_source
    assert not legacy_router.exists()


def test_all_module_lifecycle_writers_share_the_scope_lock() -> None:
    source = (repo_root() / "src" / "uok" / "module_lifecycle.py").read_text(encoding="utf-8")
    tree = ast.parse(source)
    expected = {
        "install_module",
        "uninstall_module",
        "disable_module",
        "enable_module",
        "upgrade_module",
        "reconcile_module_record",
    }
    locked: set[str] = set()
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef) or node.name not in expected:
            continue
        if any(
            isinstance(child, ast.Call)
            and isinstance(child.func, ast.Name)
            and child.func.id == "_lock_module_lifecycle_scope"
            for child in ast.walk(node)
        ):
            locked.add(node.name)

    assert locked == expected
