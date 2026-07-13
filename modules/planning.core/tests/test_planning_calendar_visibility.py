from __future__ import annotations

from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_planning_hides_private_calendar_events_even_when_party_is_visible(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    for module in ("contacts.core", "calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200

    contact = command(client, ops, "CreateContact", {
        "display_name": f"Visible planner {suffix}",
        "visibility_scope": "organization",
    }, f"private-calendar-party-{suffix}")
    assert contact.status_code == 200, contact.text
    party_id = contact.json()["result"]["contact_id"]

    calendar = command(client, ops, "CreateCalendar", {
        "name": f"Private resource calendar {suffix}",
        "timezone": "UTC",
        "visibility_scope": "private",
    }, f"private-planning-calendar-{suffix}")
    assert calendar.status_code == 200, calendar.text
    calendar_id = calendar.json()["result"]["id"]
    event_title = f"Private planning conflict {suffix}"
    event = command(client, ops, "CreateCalendarEvent", {
        "calendar_id": calendar_id,
        "title": event_title,
        "starts_at": "2031-04-04T13:00:00+00:00",
        "ends_at": "2031-04-04T14:00:00+00:00",
        "timezone": "UTC",
        "participants": [{
            "participant_type": "party",
            "participant_id": party_id,
            "display_name": f"Visible planner {suffix}",
        }],
    }, f"private-planning-event-{suffix}")
    assert event.status_code == 200, event.text

    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Private calendar plan {suffix}",
        "start": "2031-04-01",
        "end": "2031-04-10",
    }, f"private-calendar-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id,
        "title": f"Private calendar task {suffix}",
        "start": "2031-04-04",
        "end": "2031-04-04",
    }, f"private-calendar-task-{suffix}")
    assert task.status_code == 200, task.text
    task_id = task.json()["result"]["id"]
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id,
        "name": f"Visible party resource {suffix}",
        "resource_type": "human",
        "capacity_unit": "fte",
        "canonical_target_kind": "party",
        "canonical_target_id": party_id,
    }, f"private-calendar-resource-{suffix}")
    assert resource.status_code == 200, resource.text
    resource_id = next(row["id"] for row in resource.json()["result"]["resources"] if row["name"] == f"Visible party resource {suffix}")
    assigned = command(client, ops, "AssignPlanningResource", {
        "task_id": task_id,
        "resource_id": resource_id,
        "allocation_percent": 100,
    }, f"private-calendar-assignment-{suffix}")
    assert assigned.status_code == 200, assigned.text

    owner_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert owner_schedule.status_code == 200, owner_schedule.text
    assert event_title in {
        row["title"] for row in owner_schedule.json()["availability"]["busy"]
    }, owner_schedule.text
    assert any(event_title in warning for warning in owner_schedule.json()["availability"]["warnings"])

    viewer_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=viewer)
    assert viewer_schedule.status_code == 200, viewer_schedule.text
    viewer_body = viewer_schedule.json()
    visible_resource = next(row for row in viewer_body["resources"] if row["id"] == resource_id)
    assert visible_resource["canonical_target_id"] == party_id
    assert visible_resource["canonical_resolution"]["status"] == "ready"
    assert event_title not in {row["title"] for row in viewer_body["availability"]["busy"]}
    assert all(event_title not in warning for warning in viewer_body["availability"]["warnings"])


def test_planning_degrades_when_calendar_recurrence_data_is_invalid(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200

    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Invalid calendar plan {suffix}",
        "start": "2031-04-01",
        "end": "2031-04-10",
    }, f"invalid-calendar-project-{suffix}")
    assert project.status_code == 200, project.text

    import uok_calendar_core.facade as calendar_facade

    def invalid_recurrence(*_args: object, **_kwargs: object) -> list[dict[str, object]]:
        raise ValueError("recurrence_rule contains invalid legacy data")

    monkeypatch.setattr(calendar_facade, "freebusy_rows_for_participants", invalid_recurrence)
    schedule = client.get(
        f"/api/planning/projects/{project.json()['result']['id']}/schedule",
        headers=ops,
    )
    assert schedule.status_code == 200, schedule.text
    availability = schedule.json()["availability"]
    assert availability["status"] == "unavailable"
    assert availability["busy"] == []
    assert availability["events"] == []
    assert availability["reason"] == "recurrence_rule contains invalid legacy data"
    assert availability["warnings"] == [
        "Calendar availability unavailable: recurrence_rule contains invalid legacy data",
    ]
