from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import CommandLog, EventRecord
from uok_planning_core._internal.persistence.models import PlanningScheduleEvent
from uok.util import loads


def test_command_response_and_planning_events_share_one_correlation(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    suffix = str(uuid4())[:8]

    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Audit correlation {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"audit-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    _assert_correlation(project.json()["command_id"], project.json()["result"], "PlanningProjectCreated", "project_created", project_id)

    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Correlated task", "start": "2026-08-03", "end": "2026-08-05",
    }, f"audit-task-{suffix}")
    assert task.status_code == 200, task.text
    task_id = task.json()["result"]["id"]
    _assert_correlation(task.json()["command_id"], task.json()["result"], "PlanningTaskCreated", "task_created", task_id)

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    updated = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={
            **ops,
            "If-Match": schedule.headers["ETag"],
            "Idempotency-Key": f"audit-rest-update-{suffix}",
        },
        json={"progress": 55},
    )
    assert updated.status_code == 200, updated.text
    correlation_id = updated.json()["correlation_id"]
    assert updated.json()["task"]["progress"] == 55
    _assert_correlation(correlation_id, updated.json(), "PlanningTaskUpdated", "task_updated", task_id)

    with SessionLocal() as db:
        schedule_events = list(db.scalars(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id,
        )).all())
        assert len(schedule_events) == 3
        for event in schedule_events:
            event_correlation = loads(event.payload_json)["correlation_id"]
            log = db.get(CommandLog, event_correlation)
            assert log is not None and log.status == "succeeded"


def _assert_correlation(
    correlation_id: str,
    response: dict,
    event_type: str,
    schedule_event_type: str,
    object_id: str,
) -> None:
    assert response["correlation_id"] == correlation_id
    with SessionLocal() as db:
        log = db.get(CommandLog, correlation_id)
        event = db.scalar(select(EventRecord).where(
            EventRecord.event_type == event_type,
            EventRecord.object_id == object_id,
        ).order_by(EventRecord.sequence.desc()))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.event_type == schedule_event_type,
        ).order_by(PlanningScheduleEvent.created_at.desc()))
        assert log is not None and log.status == "succeeded"
        assert loads(log.response_json)["correlation_id"] == correlation_id
        assert event is not None and loads(event.payload_json)["correlation_id"] == correlation_id
        assert schedule_event is not None and loads(schedule_event.payload_json)["correlation_id"] == correlation_id
