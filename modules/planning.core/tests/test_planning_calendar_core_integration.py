from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command, user_id


def test_planning_calendar_warnings_are_correlated_to_task_resources_and_private_parties(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    for module in ("contacts.core", "calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200

    party_a = _contact(client, ops, suffix, "Planner A")
    party_b = _contact(client, ops, suffix, "Planner B")
    party_unlinked = _contact(client, ops, suffix, "Unlinked planner")
    private_party = command(client, ops, "CreateContact", {
        "display_name": f"Private planner {suffix}",
        "owner_user_id": user_id("trader"),
        "visibility_scope": "private",
    }, f"calendar-private-party-{suffix}").json()["result"]["contact_id"]
    calendar = command(client, ops, "CreateCalendar", {
        "name": f"Resource Calendar {suffix}", "timezone": "UTC",
    }, f"planning-calendar-core-calendar-{suffix}")
    calendar_id = calendar.json()["result"]["id"]
    for title, party_id in (
        ("Planner A review", party_a),
        ("Planner B review", party_b),
        ("Unrelated organization event", party_unlinked),
        ("Private review", private_party),
    ):
        event = command(client, ops, "CreateCalendarEvent", {
            "calendar_id": calendar_id,
            "title": title,
            "starts_at": "2027-08-04T13:00:00+00:00",
            "ends_at": "2027-08-04T14:00:00+00:00",
            "timezone": "UTC",
            "participants": [{"participant_type": "party", "participant_id": party_id, "display_name": title}],
        }, f"planning-calendar-event-{suffix}-{party_id}")
        assert event.status_code == 200, event.text

    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Availability Plan {suffix}", "start": "2027-08-01", "end": "2027-08-10",
    }, f"planning-calendar-core-project-{suffix}")
    project_id = project.json()["result"]["id"]
    tasks = {
        party_id: _task(client, ops, project_id, suffix, title)
        for party_id, title in (
            (party_a, "Prepare A review"),
            (party_b, "Prepare B review"),
            (private_party, "Prepare private review"),
        )
    }
    for index, (party_id, task_id) in enumerate(tasks.items()):
        resource = command(client, ops, "CreatePlanningResource", {
            "project_id": project_id,
            "name": f"Party resource {index}",
            "resource_type": "human",
            "capacity_unit": "fte",
            "canonical_target_kind": "party",
            "canonical_target_id": party_id,
        }, f"planning-party-resource-{suffix}-{index}")
        resource_id = next(row["id"] for row in resource.json()["result"]["resources"] if row["name"] == f"Party resource {index}")
        assigned = command(client, ops, "AssignPlanningResource", {
            "task_id": task_id, "resource_id": resource_id, "allocation_percent": 100,
        }, f"planning-party-assignment-{suffix}-{index}")
        assert assigned.status_code == 200, assigned.text

    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    assert schedule.status_code == 200, schedule.text
    availability = schedule.json()["availability"]
    assert availability["source_module"] == "calendar.core"
    assert availability["scope"] == "task_parties"
    assert availability["status"] == "ready"
    assert availability["correlation"] == {"party_count": 3, "task_count": 3}
    busy_by_title = {row["title"]: row for row in availability["busy"]}
    assert set(busy_by_title) == {"Planner A review", "Planner B review", "Private review"}
    assert busy_by_title["Planner A review"]["task_ids"] == [tasks[party_a]]
    assert busy_by_title["Planner B review"]["task_ids"] == [tasks[party_b]]
    warnings = availability["warnings"]
    assert any("Prepare A review: Planner A review" in item for item in warnings)
    assert any("Prepare B review: Planner B review" in item for item in warnings)
    assert all("Unrelated organization event" not in item for item in warnings)

    viewer_schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=viewer)
    assert viewer_schedule.status_code == 200, viewer_schedule.text
    viewer_availability = viewer_schedule.json()["availability"]
    assert "Private review" not in {row["title"] for row in viewer_availability["busy"]}
    assert all("private" not in item.lower() for item in viewer_availability["warnings"])
    private_resource = next(row for row in viewer_schedule.json()["resources"] if row["canonical_target_kind"] == "party" and row["name"] == "Party resource 2")
    assert private_resource["canonical_target_id"] is None
    assert private_resource["canonical_resolution"]["status"] == "denied"


def test_unlinked_calendar_events_do_not_create_planning_warnings(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    calendar = command(client, ops, "CreateCalendar", {"name": f"General {suffix}", "timezone": "UTC"}, f"general-calendar-{suffix}")
    command(client, ops, "CreateCalendarEvent", {
        "calendar_id": calendar.json()["result"]["id"], "title": "Organization event",
        "starts_at": "2027-08-04T13:00:00+00:00", "ends_at": "2027-08-04T14:00:00+00:00", "timezone": "UTC",
    }, f"general-event-{suffix}")
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Unlinked Plan {suffix}", "start": "2027-08-01", "end": "2027-08-10",
    }, f"unlinked-project-{suffix}")
    _task(client, ops, project.json()["result"]["id"], suffix, "Unlinked task")
    schedule = client.get(f"/api/planning/projects/{project.json()['result']['id']}/schedule", headers=ops).json()
    assert schedule["availability"]["busy"] == []
    assert schedule["availability"]["warnings"] == []


def test_availability_includes_linked_task_conflicts_after_project_target(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    for module in ("contacts.core", "calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    party_id = _contact(client, ops, suffix, "Late planner")
    calendar = command(client, ops, "CreateCalendar", {
        "name": f"Late Calendar {suffix}", "timezone": "UTC",
    }, f"late-calendar-{suffix}")
    event = command(client, ops, "CreateCalendarEvent", {
        "calendar_id": calendar.json()["result"]["id"], "title": "Late conflict",
        "starts_at": "2027-08-11T13:00:00+00:00", "ends_at": "2027-08-11T14:00:00+00:00",
        "timezone": "UTC", "participants": [{
            "participant_type": "party", "participant_id": party_id, "display_name": "Late planner",
        }],
    }, f"late-event-{suffix}")
    assert event.status_code == 200, event.text
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Late Plan {suffix}", "start": "2027-08-03", "end": "2027-08-05",
    }, f"late-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task_id = _task(client, ops, project_id, suffix, "Late linked task")
    moved = command(client, ops, "UpdatePlanningTask", {
        "task_id": task_id, "start": "2027-08-10", "end": "2027-08-12", "cascade": False,
    }, f"late-task-dates-{suffix}")
    assert moved.status_code == 200, moved.text
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Late party resource", "resource_type": "human",
        "capacity_unit": "fte", "canonical_target_kind": "party", "canonical_target_id": party_id,
    }, f"late-resource-{suffix}")
    resource_id = next(row["id"] for row in resource.json()["result"]["resources"] if row["name"] == "Late party resource")
    assert command(client, ops, "AssignPlanningResource", {
        "task_id": task_id, "resource_id": resource_id,
    }, f"late-assignment-{suffix}").status_code == 200
    schedule = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    assert schedule["project"]["target_finish"] == "2027-08-05"
    assert schedule["availability"]["to"].startswith("2027-08-13")
    assert any("Late linked task: Late conflict" in warning for warning in schedule["availability"]["warnings"])


def _contact(client: TestClient, ops: dict[str, str], suffix: str, name: str) -> str:
    response = command(client, ops, "CreateContact", {
        "display_name": f"{name} {suffix}", "visibility_scope": "organization",
    }, f"calendar-contact-{suffix}-{name.lower().replace(' ', '-')}")
    return response.json()["result"]["contact_id"]


def _task(client: TestClient, ops: dict[str, str], project_id: str, suffix: str, title: str) -> str:
    response = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": title, "start": "2027-08-04", "end": "2027-08-04",
    }, f"calendar-task-{suffix}-{title.lower().replace(' ', '-')}")
    assert response.status_code == 200, response.text
    return response.json()["result"]["id"]
