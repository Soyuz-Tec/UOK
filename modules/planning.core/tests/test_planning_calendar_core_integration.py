from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_planning_schedule_consumes_calendar_core_availability(client: TestClient) -> None:
    suffix = str(uuid4())[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")

    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200

    calendar = command(
        client,
        ops,
        "CreateCalendar",
        {"name": f"Delivery Calendar {suffix}", "timezone": "UTC"},
        f"planning-calendar-core-calendar-{suffix}",
    )
    assert calendar.status_code == 200, calendar.text
    calendar_id = calendar.json()["result"]["id"]
    event = command(
        client,
        ops,
        "CreateCalendarEvent",
        {
            "calendar_id": calendar_id,
            "title": "Stakeholder review",
            "starts_at": "2027-08-04T13:00:00+00:00",
            "ends_at": "2027-08-04T14:00:00+00:00",
            "timezone": "UTC",
        },
        f"planning-calendar-core-event-{suffix}",
    )
    assert event.status_code == 200, event.text

    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Availability Plan {suffix}", "start": "2027-08-01", "end": "2027-08-10"},
        f"planning-calendar-core-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    task = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Prepare review", "start": "2027-08-04", "end": "2027-08-04"},
        f"planning-calendar-core-task-{suffix}",
    )
    assert task.status_code == 200, task.text

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert schedule.status_code == 200, schedule.text
    body = schedule.json()
    assert body["availability"]["source_module"] == "calendar.core"
    assert body["availability"]["status"] == "ready"
    assert body["availability"]["busy"][0]["title"] == "Stakeholder review"
    assert any("Calendar busy time overlaps Prepare review" in item for item in body["availability"]["warnings"])
    assert body["validation"]["ok"] is True
