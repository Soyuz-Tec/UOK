from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from starlette.testclient import TestClient

from planning_requirement_test_support import (
    create_evidence_link,
    planning_with_reports,
    project_and_task,
    report_artifact,
    requirement_mutation,
    schedule,
)


def test_requirements_fail_closed_without_mutating_schedule(client: TestClient) -> None:
    _, ops, _, viewer = planning_with_reports(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = project_and_task(client, ops, suffix)
    initial = schedule(client, ops, project_id)
    denied = requirement_mutation(
        client,
        viewer,
        task_id,
        "",
        "",
        schedule(client, viewer, project_id),
        f"requirement-viewer-create-{suffix}",
        {"requirement_type": "approval", "title": "Denied approval", "required": True},
    )
    assert denied.status_code == 403, denied.text
    assert schedule(client, ops, project_id).headers["ETag"] == initial.headers["ETag"]

    evidence = requirement_mutation(
        client,
        ops,
        task_id,
        "",
        "",
        initial,
        f"requirement-unlinked-{suffix}",
        {"requirement_type": "evidence", "title": "Missing source", "required": False},
    )
    assert evidence.status_code == 200, evidence.text
    requirement_id = evidence.json()["id"]
    for action in ("submit", "start_review"):
        advanced = requirement_mutation(
            client,
            ops,
            task_id,
            requirement_id,
            "advance",
            schedule(client, ops, project_id),
            f"requirement-{action}-{suffix}",
            {"action": action},
        )
        assert advanced.status_code == 200, advanced.text

    before_failed_decision = schedule(client, ops, project_id)
    failed = requirement_mutation(
        client,
        ops,
        task_id,
        requirement_id,
        "decision",
        before_failed_decision,
        f"requirement-no-source-{suffix}",
        {"decision": "satisfy", "reason": "Should fail closed"},
    )
    assert failed.status_code == 400, failed.text
    assert failed.json()["error"]["code"] == "planning_requirement_evidence_not_ready"
    assert schedule(client, ops, project_id).headers["ETag"] == before_failed_decision.headers["ETag"]

    invalid = requirement_mutation(
        client,
        ops,
        task_id,
        requirement_id,
        "advance",
        before_failed_decision,
        f"requirement-invalid-transition-{suffix}",
        {"action": "submit"},
    )
    assert invalid.status_code == 400, invalid.text
    assert invalid.json()["error"]["code"] == "planning_requirement_transition_invalid"


def test_requirement_rejects_wrong_link_kind_and_protects_attached_source(client: TestClient) -> None:
    _, ops, _, _ = planning_with_reports(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = project_and_task(client, ops, suffix)
    artifact_id = report_artifact(client, ops, suffix)
    link = create_evidence_link(client, ops, project_id, task_id, artifact_id, suffix)
    current = schedule(client, ops, project_id)

    wrong_kind = requirement_mutation(
        client,
        ops,
        task_id,
        "",
        "",
        current,
        f"requirement-wrong-kind-{suffix}",
        {"requirement_type": "shipment", "title": "Shipment release", "target_link_id": link["id"]},
    )
    assert wrong_kind.status_code == 400, wrong_kind.text
    assert wrong_kind.json()["error"]["field"] == "target_link_id"
    assert schedule(client, ops, project_id).headers["ETag"] == current.headers["ETag"]

    created = requirement_mutation(
        client,
        ops,
        task_id,
        "",
        "",
        current,
        f"requirement-linked-{suffix}",
        {"requirement_type": "evidence", "title": "Protected source", "target_link_id": link["id"]},
    )
    assert created.status_code == 200, created.text
    latest = schedule(client, ops, project_id)
    removed = client.delete(
        f"/api/planning/projects/{project_id}/links/{link['id']}",
        headers={**ops, "Idempotency-Key": f"requirement-remove-link-{suffix}", "If-Match": latest.headers["ETag"]},
    )
    assert removed.status_code == 400, removed.text
    assert removed.json()["error"]["code"] == "planning_link_in_use"
    assert schedule(client, ops, project_id).headers["ETag"] == latest.headers["ETag"]


def test_requirement_source_replacement_invalidates_review_and_decision(client: TestClient) -> None:
    _, ops, _, _ = planning_with_reports(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = project_and_task(client, ops, suffix)
    created = requirement_mutation(
        client, ops, task_id, "", "", schedule(client, ops, project_id), f"requirement-repair-{suffix}",
        {"requirement_type": "evidence", "title": "Repairable evidence", "required": True},
    )
    requirement_id = created.json()["id"]
    for action in ("submit", "start_review"):
        response = requirement_mutation(
            client, ops, task_id, requirement_id, "advance", schedule(client, ops, project_id),
            f"requirement-repair-{action}-{suffix}", {"action": action},
        )
        assert response.status_code == 200, response.text
    unavailable = requirement_mutation(
        client, ops, task_id, requirement_id, "decision", schedule(client, ops, project_id),
        f"requirement-repair-fail-{suffix}", {"decision": "satisfy", "reason": "No evidence yet"},
    )
    assert unavailable.status_code == 400, unavailable.text

    artifact_id = report_artifact(client, ops, f"repair-{suffix}")
    link = create_evidence_link(client, ops, project_id, task_id, artifact_id, f"repair-{suffix}")
    linked = client.put(
        f"/api/planning/tasks/{task_id}/requirements/{requirement_id}/link",
        headers={
            **ops,
            "Idempotency-Key": f"requirement-source-link-{suffix}",
            "If-Match": schedule(client, ops, project_id).headers["ETag"],
        },
        json={"target_link_id": link["id"]},
    )
    assert linked.status_code == 200, linked.text
    assert linked.json()["state"] == "submitted"
    assert linked.json()["target_link_state"] == "ready"

    reviewed = requirement_mutation(
        client, ops, task_id, requirement_id, "advance", schedule(client, ops, project_id),
        f"requirement-repair-review-again-{suffix}", {"action": "start_review"},
    )
    assert reviewed.status_code == 200, reviewed.text
    satisfied = requirement_mutation(
        client, ops, task_id, requirement_id, "decision", schedule(client, ops, project_id),
        f"requirement-repair-satisfy-{suffix}", {"decision": "satisfy", "reason": "Replacement reviewed"},
    )
    assert satisfied.status_code == 200, satisfied.text
    assert satisfied.json()["state"] == "satisfied"

    detached = client.put(
        f"/api/planning/tasks/{task_id}/requirements/{requirement_id}/link",
        headers={
            **ops,
            "Idempotency-Key": f"requirement-source-detach-{suffix}",
            "If-Match": schedule(client, ops, project_id).headers["ETag"],
        },
        json={"target_link_id": None},
    )
    assert detached.status_code == 200, detached.text
    assert detached.json()["state"] == "missing"
    assert detached.json()["decision_reason"] is None
    assert detached.json()["blocking"] is True


def test_requirement_reject_resubmit_and_waive_lifecycle(client: TestClient) -> None:
    _, ops, _, _ = planning_with_reports(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = project_and_task(client, ops, suffix)
    created = requirement_mutation(
        client, ops, task_id, "", "", schedule(client, ops, project_id), f"requirement-waive-{suffix}",
        {"requirement_type": "approval", "title": "Operational approval", "required": True},
    )
    requirement_id = created.json()["id"]
    for action in ("submit", "start_review"):
        response = requirement_mutation(
            client, ops, task_id, requirement_id, "advance", schedule(client, ops, project_id),
            f"requirement-reject-{action}-{suffix}", {"action": action},
        )
        assert response.status_code == 200, response.text
    rejected = requirement_mutation(
        client, ops, task_id, requirement_id, "decision", schedule(client, ops, project_id),
        f"requirement-reject-{suffix}", {"decision": "reject", "reason": "Approval package is incomplete"},
    )
    assert rejected.status_code == 200, rejected.text
    assert rejected.json()["state"] == "rejected"
    assert rejected.json()["blocking"] is True

    for action in ("submit", "start_review"):
        response = requirement_mutation(
            client, ops, task_id, requirement_id, "advance", schedule(client, ops, project_id),
            f"requirement-waive-{action}-{suffix}", {"action": action},
        )
        assert response.status_code == 200, response.text
    waived = requirement_mutation(
        client, ops, task_id, requirement_id, "decision", schedule(client, ops, project_id),
        f"requirement-waive-decision-{suffix}", {"decision": "waive", "reason": "Executive exception approved"},
    )
    assert waived.status_code == 200, waived.text
    assert waived.json()["state"] == "waived"
    assert waived.json()["blocking"] is False
    assert schedule(client, ops, project_id).json()["readiness"]["ready"] is True


def test_requirement_migration_and_manifest_are_module_owned() -> None:
    root = Path(__file__).parents[1]
    sql = (root / "migrations" / "008_planning_task_requirements.sql").read_text(encoding="utf-8")
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS planning_task_requirements" in sql
    for constraint in (
        "ck_planning_requirement_type",
        "ck_planning_requirement_state",
        "ck_planning_requirement_decision",
    ):
        assert constraint in sql
    for value in (
        "CreatePlanningTaskRequirement",
        "AdvancePlanningTaskRequirement",
        "SetPlanningTaskRequirementLink",
        "DecidePlanningTaskRequirement",
        "PlanningTaskRequirementCreated",
        "PlanningTaskRequirementAdvanced",
        "PlanningTaskRequirementLinkSet",
        "PlanningTaskRequirementDecided",
        "PlanningTaskRequirement",
    ):
        assert value in manifest
