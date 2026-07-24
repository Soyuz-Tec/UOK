from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_calendar_event_link_resolves_through_calendar_public_api(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text

    calendar = command(
        client,
        ops,
        "CreateCalendar",
        {"name": f"Planning link calendar {suffix}", "timezone": "UTC"},
        f"planning-link-calendar-{suffix}",
    )
    event = command(
        client,
        ops,
        "CreateCalendarEvent",
        {
            "calendar_id": calendar.json()["result"]["id"],
            "title": f"Planning milestone {suffix}",
            "starts_at": "2031-04-04T13:00:00+00:00",
            "ends_at": "2031-04-04T14:00:00+00:00",
            "timezone": "UTC",
        },
        f"planning-link-event-{suffix}",
    )
    event_id = event.json()["result"]["id"]
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Calendar link plan {suffix}", "start": "2031-04-01", "end": "2031-04-10"},
        f"planning-link-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    linked = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={
            **ops,
            "Idempotency-Key": f"planning-calendar-event-link-{suffix}",
            "If-Match": schedule.headers["ETag"],
        },
        json={
            "scope_type": "project",
            "relationship": "occurs_at",
            "target": {"kind": "calendar_event", "id": event_id},
        },
    )

    assert linked.status_code == 200, linked.text
    resolution = linked.json()["resolution"]
    assert resolution["status"] == "ready"
    assert resolution["display_label"] == f"Planning milestone {suffix}"
    assert resolution["status_summary"] == "Calendar event is confirmed."
    assert resolution["open_path"] == f"/?view=calendar&event_id={event_id}"
