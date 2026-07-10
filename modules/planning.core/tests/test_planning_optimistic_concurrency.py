from __future__ import annotations

import re
from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth

STRONG_ETAG = re.compile(r'^"planning-r[1-9][0-9]*-sha256-[a-f0-9]{64}"$')


def test_planning_rest_enforces_strong_etags_and_replays_before_stale_checks(client: TestClient) -> None:
    admin, ops = _planning_users(client)
    suffix = str(uuid4())[:8]
    created = client.post(
        "/api/planning/projects",
        headers={**ops, "Idempotency-Key": f"concurrency-project-{suffix}"},
        json={"name": f"Concurrency {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
    )
    assert created.status_code == 200, created.text
    project_id = created.json()["id"]
    assert created.json()["revision"] == 1
    initial_etag = created.headers["ETag"]
    assert STRONG_ETAG.fullmatch(initial_etag)

    first_read = _schedule(client, ops, project_id)
    second_read = _schedule(client, ops, project_id)
    assert first_read.headers["ETag"] == second_read.headers["ETag"] == initial_etag
    assert first_read.headers["Cache-Control"] == "private, no-store"
    assert first_read.headers["Vary"] == "Authorization"

    task_payload = {"title": "Protected task", "start": "2026-08-03", "end": "2026-08-05", "expected_revision": 1}
    missing = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": f"concurrency-missing-{suffix}"},
        json=task_payload,
    )
    assert missing.status_code == 428, missing.text
    assert missing.json()["error"] == {
        "code": "precondition_required",
        "message": "A current strong Planning ETag is required for this mutation.",
        "repair": "Reload the schedule, review the latest state, and retry with its exact ETag.",
        "current_revision": 1,
        "current_etag": initial_etag,
        "object_ids": [project_id],
        "reload_url": f"/api/planning/projects/{project_id}/schedule",
    }

    for label, invalid in (("weak", f"W/{initial_etag}"), ("wildcard", "*"), ("list", f"{initial_etag}, {initial_etag}"), ("unquoted", initial_etag.strip('"'))):
        rejected = client.post(
            f"/api/planning/projects/{project_id}/tasks",
            headers={**ops, "Idempotency-Key": f"concurrency-{label}-{suffix}", "If-Match": invalid},
            json=task_payload,
        )
        assert rejected.status_code == 400, rejected.text
        assert rejected.json()["error"]["code"] == "invalid_precondition"

    inconsistent = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": f"concurrency-inconsistent-{suffix}", "If-Match": initial_etag},
        json={**task_payload, "expected_revision": 2},
    )
    assert inconsistent.status_code == 400, inconsistent.text
    assert inconsistent.json()["error"]["code"] == "inconsistent_precondition"

    intent_key = f"concurrency-task-intent-{suffix}"
    accepted = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": intent_key, "If-Match": initial_etag},
        json=task_payload,
    )
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["revision"] == 2
    assert accepted.json()["version"] == 1
    accepted_etag = accepted.headers["ETag"]
    assert accepted_etag != initial_etag

    replay = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": intent_key, "If-Match": initial_etag},
        json=task_payload,
    )
    assert replay.status_code == 200, replay.text
    assert replay.json() == accepted.json()
    assert replay.headers["ETag"] == accepted_etag
    assert _schedule(client, ops, project_id).json()["project"]["revision"] == 2

    changed_replay = client.post(
        f"/api/planning/projects/{project_id}/tasks",
        headers={**ops, "Idempotency-Key": intent_key, "If-Match": accepted_etag},
        json={**task_payload, "title": "Changed retry"},
    )
    assert changed_replay.status_code == 409, changed_replay.text

    task_id = accepted.json()["id"]
    stale = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={**ops, "Idempotency-Key": f"concurrency-stale-{suffix}", "If-Match": initial_etag},
        json={"progress": 50},
    )
    assert stale.status_code == 412, stale.text
    assert stale.json()["error"]["code"] == "stale_precondition"
    assert stale.json()["error"]["current_revision"] == 2
    assert stale.headers["ETag"] == accepted_etag

    updated = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={**ops, "Idempotency-Key": f"concurrency-update-{suffix}", "If-Match": accepted_etag},
        json={"progress": 50, "expected_revision": 2},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["revision"] == 3
    assert updated.json()["task"]["version"] == 2
    final = _schedule(client, ops, project_id)
    assert final.headers["ETag"] == updated.headers["ETag"]
    assert final.json()["project"]["revision"] == 3
    assert final.json()["tasks"][0]["version"] == 2

    invalid = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={**ops, "Idempotency-Key": f"concurrency-invalid-{suffix}", "If-Match": final.headers["ETag"]},
        json={"start": "2026-09-01"},
    )
    assert invalid.status_code == 400, invalid.text
    unchanged = _schedule(client, ops, project_id)
    assert unchanged.headers["ETag"] == final.headers["ETag"]
    assert unchanged.json()["project"]["revision"] == 3
    assert unchanged.json()["tasks"][0]["version"] == 2


def test_generic_planning_commands_cannot_bypass_concurrency_and_version_derived_changes(client: TestClient) -> None:
    _, ops = _planning_users(client)
    suffix = str(uuid4())[:8]
    project = _command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Derived versions {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"derived-project-{suffix}",
    )
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    etag = project.headers["ETag"]

    missing = _command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Predecessor", "start": "2026-08-03", "end": "2026-08-05"},
        f"derived-missing-{suffix}",
    )
    assert missing.status_code == 428, missing.text

    first = _command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Predecessor", "start": "2026-08-03", "end": "2026-08-05"},
        f"derived-first-{suffix}",
        etag,
    )
    assert first.status_code == 200, first.text
    first_id = first.json()["result"]["id"]
    etag = first.headers["ETag"]
    second = _command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Successor", "start": "2026-08-03", "end": "2026-08-04"},
        f"derived-second-{suffix}",
        etag,
    )
    assert second.status_code == 200, second.text
    second_id = second.json()["result"]["id"]
    etag = second.headers["ETag"]
    linked = _command(
        client,
        ops,
        "LinkPlanningTasks",
        {"project_id": project_id, "predecessor_task_id": first_id, "successor_task_id": second_id},
        f"derived-link-{suffix}",
        etag,
    )
    assert linked.status_code == 200, linked.text
    schedule = linked.json()["result"]
    tasks = {task["id"]: task for task in schedule["tasks"]}
    assert schedule["project"]["revision"] == 4
    assert tasks[first_id]["version"] == 1
    assert tasks[second_id]["version"] == 2
    assert tasks[second_id]["start"] == "2026-08-06"


def test_all_existing_project_rest_mutations_require_if_match(client: TestClient) -> None:
    _, ops = _planning_users(client)
    suffix = str(uuid4())[:8]
    project = _command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"REST preconditions {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"rest-preconditions-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    etag = project.headers["ETag"]
    first = _command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": "First task", "start": "2026-08-03", "end": "2026-08-05"}, f"rest-first-{suffix}", etag)
    first_id = first.json()["result"]["id"]
    etag = first.headers["ETag"]
    second = _command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": "Second task", "start": "2026-08-06", "end": "2026-08-08"}, f"rest-second-{suffix}", etag)
    second_id = second.json()["result"]["id"]
    etag = second.headers["ETag"]
    dependency = _command(client, ops, "LinkPlanningTasks", {"project_id": project_id, "predecessor_task_id": first_id, "successor_task_id": second_id}, f"rest-link-{suffix}", etag)
    dependency_id = dependency.json()["result"]["dependencies"][0]["id"]
    etag = dependency.headers["ETag"]
    resource = _command(client, ops, "CreatePlanningResource", {"project_id": project_id, "name": "Planner", "role": "Scheduling"}, f"rest-resource-{suffix}", etag)
    resource_id = resource.json()["result"]["resources"][0]["id"]
    revision = resource.json()["result"]["project"]["revision"]

    cases = [
        ("POST", f"/api/planning/projects/{project_id}/tasks", {"title": "Third task", "start": "2026-08-11", "end": "2026-08-12"}),
        ("PATCH", f"/api/planning/tasks/{first_id}", {"progress": 20}),
        ("DELETE", f"/api/planning/tasks/{first_id}", None),
        ("POST", f"/api/planning/projects/{project_id}/dependencies", {"predecessor_task_id": second_id, "successor_task_id": first_id}),
        ("PATCH", f"/api/planning/dependencies/{dependency_id}", {"lag_days": 1}),
        ("DELETE", f"/api/planning/dependencies/{dependency_id}", None),
        ("PUT", f"/api/planning/projects/{project_id}/calendar", {"name": "Standard", "working_days": [1, 2, 3, 4, 5]}),
        ("POST", f"/api/planning/projects/{project_id}/baselines", {"name": "Protected baseline"}),
        ("POST", f"/api/planning/projects/{project_id}/resources", {"name": "Protected resource", "role": "Reviewer"}),
        ("POST", "/api/planning/assignments", {"task_id": first_id, "resource_id": resource_id, "allocation_percent": 100}),
    ]
    for index, (method, path, body) in enumerate(cases):
        response = client.request(
            method,
            path,
            headers={**ops, "Idempotency-Key": f"rest-missing-{index}-{suffix}"},
            json=body,
        )
        assert response.status_code == 428, f"{method} {path}: {response.text}"
        assert response.json()["error"]["code"] == "precondition_required"
    assert _schedule(client, ops, project_id).json()["project"]["revision"] == revision


def _planning_users(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return admin, ops


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _command(
    client: TestClient,
    headers: dict[str, str],
    command_type: str,
    payload: dict[str, object],
    key: str,
    etag: str | None = None,
):
    request_headers = {**headers, **({"If-Match": etag} if etag else {})}
    return client.post("/api/commands", headers=request_headers, json={
        "command_type": command_type,
        "payload": payload,
        "idempotency_key": key,
    })
