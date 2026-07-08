from __future__ import annotations


def assert_baseline_evidence_checks(checks: dict[str, bool]) -> None:
    expected_true = [
        "apps_manager_operational",
        "contacts_module_available_to_install",
        "contacts_module_operational",
        "planning_module_available_to_install",
        "planning_module_operational",
        "module_lifecycle_events_present",
        "contact_full_crm_events_present",
        "private_notes_available",
        "relationships_available",
        "contact_groups_available",
        "contact_group_members_available",
        "import_batches_available",
        "review_queue_available",
        "role_denials_recorded",
        "validation_errors_recorded",
    ]
    for key in expected_true:
        assert checks[key] is True


def assert_module_lifecycle_and_evidence(client, admin: dict[str, str]) -> None:
    dashboard = client.get("/api/dashboard", headers=admin)
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["counts"]["contacts"] >= 1
    assert dashboard.json()["counts"]["organizations"] >= 1
    assert dashboard.json()["counts"]["review_queue"] >= 1

    lifecycle = client.get("/api/modules/lifecycle", headers=admin)
    assert lifecycle.status_code == 200, lifecycle.text
    lifecycle_checks = lifecycle.json()["checks"]
    for key in (
        "apps_manager_declared",
        "agents_declared_as_available_module",
        "contacts_declared_as_available_module",
        "planning_declared_as_available_module",
        "only_apps_manager_required",
        "no_business_modules_declared",
        "agents_installable",
        "agents_uninstallable",
        "contacts_installable",
        "contacts_uninstallable",
        "planning_installable",
        "planning_uninstallable",
    ):
        assert lifecycle_checks[key] is True

    evidence = client.get("/api/baseline-evidence", headers=admin)
    assert evidence.status_code == 200, evidence.text
    assert evidence.json()["ok"] is True
    assert_baseline_evidence_checks(evidence.json()["checks"])

    verify = client.post("/api/architecture/verify-baseline", headers=admin)
    assert verify.status_code == 200, verify.text
    assert verify.json()["result"]["ok"] is True
    assert verify.json()["result"]["checks"]["module_neutral_baseline"] is True
    assert verify.json()["result"]["checks"]["module_lifecycle_ok"] is True
