from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from planning_requirement_test_support import (
    assert_requirement_correlation,
    create_evidence_link,
    planning_with_reports,
    project_and_task,
    report_artifact,
    requirement_mutation,
    schedule,
)


def test_required_evidence_lifecycle_controls_readiness_audit_and_baseline(client: TestClient) -> None:
    admin, ops, trader, viewer = planning_with_reports(client)
    suffix = uuid4().hex[:8]
    project_id, task_id = project_and_task(client, ops, suffix)
    artifact_id = report_artifact(client, ops, suffix)
    link = create_evidence_link(client, ops, project_id, task_id, artifact_id, suffix)
    before = schedule(client, ops, project_id)
    original_version = before.json()["tasks"][0]["version"]

    created = requirement_mutation(
        client,
        ops,
        task_id,
        "",
        "",
        before,
        f"requirement-create-{suffix}",
        {
            "requirement_type": "evidence",
            "title": "Signed execution evidence",
            "required": True,
            "target_link_id": link["id"],
            "due": "2026-08-05",
        },
    )
    assert created.status_code == 200, created.text
    requirement = created.json()
    assert requirement["state"] == "missing"
    assert requirement["blocking"] is True
    assert requirement["target_link_state"] == "ready"
    assert requirement["due"] == "2026-08-05"
    assert_requirement_correlation(
        requirement["id"], requirement["correlation_id"], project_id, "PlanningTaskRequirementCreated"
    )

    blocked = schedule(client, ops, project_id)
    assert blocked.json()["readiness"] == {
        "ready": False,
        "required_count": 1,
        "blocking_count": 1,
        "blocking_requirement_ids": [requirement["id"]],
        "task_blocker_count": 1,
    }
    assert blocked.json()["tasks"][0]["version"] == original_version + 1
    assert blocked.json()["tasks"][0]["readiness"]["ready"] is False

    submitted = requirement_mutation(
        client,
        ops,
        task_id,
        requirement["id"],
        "advance",
        blocked,
        f"requirement-submit-{suffix}",
        {"action": "submit"},
    )
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["state"] == "submitted"
    reviewing = requirement_mutation(
        client,
        ops,
        task_id,
        requirement["id"],
        "advance",
        schedule(client, ops, project_id),
        f"requirement-review-{suffix}",
        {"action": "start_review"},
    )
    assert reviewing.status_code == 200, reviewing.text
    assert reviewing.json()["state"] == "under_review"

    for actor, role in ((trader, "trader"), (viewer, "viewer")):
        denied = requirement_mutation(
            client,
            actor,
            task_id,
            requirement["id"],
            "decision",
            schedule(client, actor, project_id),
            f"requirement-denied-{role}-{suffix}",
            {"decision": "satisfy", "reason": "Unauthorized decision"},
        )
        assert denied.status_code == 403, denied.text
        assert "planning.gate.approve" in denied.text

    current = schedule(client, ops, project_id)
    before_decision_version = current.json()["tasks"][0]["version"]
    decided = requirement_mutation(
        client,
        ops,
        task_id,
        requirement["id"],
        "decision",
        current,
        f"requirement-satisfy-{suffix}",
        {"decision": "satisfy", "reason": "Artifact reviewed and accepted"},
    )
    assert decided.status_code == 200, decided.text
    assert decided.json()["state"] == "satisfied"
    assert decided.json()["decision_reason"] == "Artifact reviewed and accepted"
    assert decided.json()["decided_by_actor_id"]
    assert decided.json()["decided_at"]
    assert_requirement_correlation(
        requirement["id"], decided.json()["correlation_id"], project_id, "PlanningTaskRequirementDecided"
    )
    ready = schedule(client, ops, project_id)
    assert ready.json()["readiness"]["ready"] is True
    assert ready.json()["tasks"][0]["version"] == before_decision_version + 1

    baseline = client.post(
        f"/api/planning/projects/{project_id}/baselines",
        headers={**ops, "Idempotency-Key": f"requirement-baseline-{suffix}", "If-Match": ready.headers["ETag"]},
        json={"name": "Gate readiness baseline"},
    )
    assert baseline.status_code == 200, baseline.text
    baseline_id = baseline.json()["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    captured = detail.json()["snapshot"]["requirements"][0]
    assert captured["id"] == requirement["id"]
    assert captured["state"] == "satisfied"
    assert detail.json()["integrity"]["verified"] is True

    before_outage = schedule(client, ops, project_id)
    assert client.post("/api/modules/reports.core/disable", headers=admin).status_code == 200
    unavailable = schedule(client, ops, project_id)
    assert unavailable.json()["project"]["revision"] == before_outage.json()["project"]["revision"]
    assert unavailable.headers["ETag"] != before_outage.headers["ETag"]
    assert unavailable.json()["requirements"][0]["target_link_state"] == "unavailable"
    assert unavailable.json()["requirements"][0]["blocking"] is True
    assert unavailable.json()["readiness"]["ready"] is False
    assert client.post("/api/modules/reports.core/enable", headers=admin).status_code == 200
    assert schedule(client, ops, project_id).json()["readiness"]["ready"] is True
