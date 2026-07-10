from __future__ import annotations

from json import loads
from uuid import uuid4

from sqlalchemy import func, select
from starlette.testclient import TestClient

from planning_batch_test_support import BatchFixture, planning_fixture, planning_users, schedule
from tests.helpers import auth
from uok.db import SessionLocal
from uok.models import CommandLog, EventRecord, PlanningScheduleEvent


def test_mixed_batch_applies_all_ten_kinds_in_order_with_one_revision_and_correlation(client: TestClient) -> None:
    ops = planning_users(client)
    suffix = uuid4().hex[:8]
    fixture = planning_fixture(client, ops, suffix)
    before = schedule(client, ops, fixture.project_id)
    before_tasks = {row["id"]: row for row in before.json()["tasks"]}
    operations = _all_operations(fixture, suffix)

    accepted = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={
            **ops,
            "Idempotency-Key": f"planning-mixed-batch-{suffix}",
            "If-Match": before.headers["ETag"],
        },
        json={"expected_revision": before.json()["project"]["revision"], "reason": "Apply governed mixed proposal", "operations": operations},
    )

    assert accepted.status_code == 200, accepted.text
    body = accepted.json()
    assert body["previous_revision"] == before.json()["project"]["revision"]
    assert body["revision"] == body["previous_revision"] + 1
    assert body["schedule"]["project"]["revision"] == body["revision"]
    assert [row["operation_id"] for row in body["operation_results"]] == [row["operation_id"] for row in operations]
    assert all(row["status"] == "applied" and row["object_ids"] for row in body["operation_results"])
    assert body["schedule"]["validation"]["ok"] is True
    tasks = {row["id"]: row for row in body["schedule"]["tasks"]}
    assert tasks[fixture.second_task_id]["progress"] == 35
    assert tasks[fixture.first_task_id]["version"] == before_tasks[fixture.first_task_id]["version"] + 1
    assert tasks[fixture.second_task_id]["version"] == before_tasks[fixture.second_task_id]["version"] + 1
    assert [(row["predecessor_task_id"], row["successor_task_id"], row["dependency_type"]) for row in body["schedule"]["dependencies"]] == [
        (fixture.first_task_id, fixture.second_task_id, "start_to_start")
    ]
    assert [(row["task_id"], row["resource_id"], row["allocation_percent"]) for row in body["schedule"]["assignments"]] == [
        (fixture.second_task_id, fixture.resource_id, 75)
    ]
    assert fixture.link_id not in {row["id"] for row in body["schedule"]["links"]}
    assert any(row["target"]["id"] == f"operation-new-{suffix}" for row in body["schedule"]["links"])
    requirement = next(row for row in body["schedule"]["requirements"] if row["id"] == fixture.requirement_id)
    assert requirement["state"] == "submitted"
    _assert_correlated_operation_events(body["correlation_id"], fixture.project_id)


def test_late_mixed_operation_failure_rolls_back_task_assignment_and_link(client: TestClient) -> None:
    ops = planning_users(client)
    suffix = uuid4().hex[:8]
    fixture = planning_fixture(client, ops, suffix)
    before = schedule(client, ops, fixture.project_id)
    before_batch_events = _batch_event_count(fixture.project_id)

    rejected = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={
            **ops,
            "Idempotency-Key": f"planning-mixed-rollback-{suffix}",
            "If-Match": before.headers["ETag"],
        },
        json={
            "operations": [
                {"operation_id": "change-task", "kind": "update_task", "payload": {"task_id": fixture.first_task_id, "progress": 60}},
                {"operation_id": "drop-assignment", "kind": "unassign_resource", "payload": {"assignment_id": fixture.assignment_id}},
                {"operation_id": "drop-link", "kind": "remove_link", "payload": {"link_id": fixture.link_id}},
                {
                    "operation_id": "invalid-dependency",
                    "kind": "create_dependency",
                    "payload": {"predecessor_task_id": fixture.first_task_id, "successor_task_id": "missing-task"},
                },
            ]
        },
    )

    assert rejected.status_code == 400, rejected.text
    error = rejected.json()["error"]
    assert error["code"] == "batch_operation_invalid"
    assert error["field"] == "operations[3].payload"
    assert error["correlation_id"]
    after = schedule(client, ops, fixture.project_id)
    assert after.headers["ETag"] == before.headers["ETag"]
    assert after.json()["project"]["revision"] == before.json()["project"]["revision"]
    first = next(row for row in after.json()["tasks"] if row["id"] == fixture.first_task_id)
    assert first["progress"] == 0
    assert fixture.assignment_id in {row["id"] for row in after.json()["assignments"]}
    assert fixture.link_id in {row["id"] for row in after.json()["links"]}
    assert _batch_event_count(fixture.project_id) == before_batch_events
    with SessionLocal() as db:
        log = db.get(CommandLog, error["correlation_id"])
        assert log is not None and log.status == "validation_error"


def test_batch_does_not_escalate_link_or_gate_capabilities_for_edit_only_actor(client: TestClient) -> None:
    ops = planning_users(client)
    trader = auth(client, "trader", "trader123")
    suffix = uuid4().hex[:8]
    fixture = planning_fixture(client, ops, suffix)
    before = schedule(client, trader, fixture.project_id)

    denied = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={**trader, "Idempotency-Key": f"planning-batch-link-denied-{suffix}", "If-Match": before.headers["ETag"]},
        json={
            "operations": [{
                "operation_id": "privileged-link",
                "kind": "create_link",
                "payload": {
                    "scope_type": "project",
                    "relationship": "implements",
                    "target": {"kind": "operation", "id": f"denied-operation-{suffix}"},
                },
            }]
        },
    )

    assert denied.status_code == 403, denied.text
    assert denied.json()["error"]["code"] == "batch_operation_permission_denied"
    assert "planning.link" in denied.json()["error"]["message"]
    assert schedule(client, trader, fixture.project_id).headers["ETag"] == before.headers["ETag"]

    submit_before = schedule(client, ops, fixture.project_id)
    submitted = client.post(
        f"/api/planning/tasks/{fixture.first_task_id}/requirements/{fixture.requirement_id}/advance",
        headers={
            **ops,
            "Idempotency-Key": f"planning-batch-gate-submit-{suffix}",
            "If-Match": submit_before.headers["ETag"],
        },
        json={"action": "submit"},
    )
    assert submitted.status_code == 200, submitted.text
    review_before = schedule(client, ops, fixture.project_id)
    reviewing = client.post(
        f"/api/planning/tasks/{fixture.first_task_id}/requirements/{fixture.requirement_id}/advance",
        headers={
            **ops,
            "Idempotency-Key": f"planning-batch-gate-review-{suffix}",
            "If-Match": review_before.headers["ETag"],
        },
        json={"action": "start_review"},
    )
    assert reviewing.status_code == 200, reviewing.text
    gate_before = schedule(client, trader, fixture.project_id)
    gate_denied = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={
            **trader,
            "Idempotency-Key": f"planning-batch-gate-denied-{suffix}",
            "If-Match": gate_before.headers["ETag"],
        },
        json={"operations": [{
            "operation_id": "privileged-gate-decision",
            "kind": "transition_gate",
            "payload": {
                "task_id": fixture.first_task_id,
                "requirement_id": fixture.requirement_id,
                "action": "satisfy",
                "reason": "Attempted through edit-only batch",
            },
        }]},
    )
    assert gate_denied.status_code == 403, gate_denied.text
    assert gate_denied.json()["error"]["code"] == "batch_operation_permission_denied"
    assert "planning.gate.approve" in gate_denied.json()["error"]["message"]
    assert schedule(client, trader, fixture.project_id).headers["ETag"] == gate_before.headers["ETag"]


def test_assignment_and_task_link_batches_increment_only_the_affected_task_version(client: TestClient) -> None:
    ops = planning_users(client)
    suffix = uuid4().hex[:8]
    fixture = planning_fixture(client, ops, suffix)

    before_assignment = schedule(client, ops, fixture.project_id)
    assignment_versions = {row["id"]: row["version"] for row in before_assignment.json()["tasks"]}
    assigned = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={
            **ops,
            "Idempotency-Key": f"planning-assignment-version-{suffix}",
            "If-Match": before_assignment.headers["ETag"],
        },
        json={"operations": [{
            "operation_id": "reassign-resource",
            "kind": "assign_resource",
            "payload": {
                "task_id": fixture.first_task_id,
                "resource_id": fixture.resource_id,
                "allocation_percent": 75,
            },
        }]},
    )
    assert assigned.status_code == 200, assigned.text
    assigned_versions = {row["id"]: row["version"] for row in assigned.json()["schedule"]["tasks"]}
    assert assigned_versions[fixture.first_task_id] == assignment_versions[fixture.first_task_id] + 1
    assert assigned_versions[fixture.second_task_id] == assignment_versions[fixture.second_task_id]

    before_link = schedule(client, ops, fixture.project_id)
    link_versions = {row["id"]: row["version"] for row in before_link.json()["tasks"]}
    linked = client.post(
        f"/api/planning/projects/{fixture.project_id}/mutations:batch",
        headers={
            **ops,
            "Idempotency-Key": f"planning-task-link-version-{suffix}",
            "If-Match": before_link.headers["ETag"],
        },
        json={"operations": [{
            "operation_id": "create-task-link",
            "kind": "create_link",
            "payload": {
                "scope_type": "task",
                "task_id": fixture.second_task_id,
                "relationship": "implements",
                "target": {"kind": "operation", "id": f"task-operation-{suffix}"},
            },
        }]},
    )
    assert linked.status_code == 200, linked.text
    linked_versions = {row["id"]: row["version"] for row in linked.json()["schedule"]["tasks"]}
    assert linked_versions[fixture.first_task_id] == link_versions[fixture.first_task_id]
    assert linked_versions[fixture.second_task_id] == link_versions[fixture.second_task_id] + 1


def _all_operations(fixture: BatchFixture, suffix: str) -> list[dict]:
    return [
        {"operation_id": "update-task", "kind": "update_task", "payload": {"task_id": fixture.second_task_id, "progress": 35}},
        {"operation_id": "update-dependency", "kind": "update_dependency", "payload": {"dependency_id": fixture.dependency_id, "lag_days": 1}},
        {"operation_id": "remove-dependency", "kind": "remove_dependency", "payload": {"dependency_id": fixture.dependency_id}},
        {
            "operation_id": "create-dependency",
            "kind": "create_dependency",
            "payload": {"predecessor_task_id": fixture.first_task_id, "successor_task_id": fixture.second_task_id, "dependency_type": "start_to_start"},
        },
        {"operation_id": "unassign-resource", "kind": "unassign_resource", "payload": {"assignment_id": fixture.assignment_id}},
        {"operation_id": "assign-resource", "kind": "assign_resource", "payload": {"task_id": fixture.second_task_id, "resource_id": fixture.resource_id, "allocation_percent": 75}},
        {"operation_id": "set-calendar", "kind": "set_calendar", "payload": {"name": "Batch Standard", "working_days": [1, 2, 3, 4, 5], "holidays": [], "ignored_periods": []}},
        {"operation_id": "remove-link", "kind": "remove_link", "payload": {"link_id": fixture.link_id}},
        {
            "operation_id": "create-link",
            "kind": "create_link",
            "payload": {"scope_type": "project", "relationship": "implements", "target": {"kind": "operation", "id": f"operation-new-{suffix}"}},
        },
        {"operation_id": "transition-gate", "kind": "transition_gate", "payload": {"task_id": fixture.first_task_id, "requirement_id": fixture.requirement_id, "action": "submit"}},
    ]


def _batch_event_count(project_id: str) -> int:
    with SessionLocal() as db:
        return int(db.scalar(select(func.count()).select_from(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id, PlanningScheduleEvent.event_type == "batch_applied",
        )) or 0)


def _assert_correlated_operation_events(command_id: str, project_id: str) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, command_id)
        module_events = db.scalars(select(EventRecord).where(EventRecord.payload_json.contains(command_id))).all()
        schedule_events = db.scalars(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id, PlanningScheduleEvent.payload_json.contains(command_id),
        )).all()
        assert log is not None and log.status == "succeeded"
        assert {row.event_type for row in module_events} >= {
            "PlanningLinkRemoved", "PlanningLinkCreated", "PlanningTaskRequirementAdvanced", "PlanningBatchApplied",
        }
        assert {row.event_type for row in schedule_events} >= {
            "link_removed", "link_created", "task_requirement_advanced", "batch_applied",
        }
        assert all(loads(row.payload_json)["correlation_id"] == command_id for row in [*module_events, *schedule_events])
        batch_event = next(row for row in schedule_events if row.event_type == "batch_applied")
        assert len(loads(batch_event.payload_json)["operation_results"]) == 10
