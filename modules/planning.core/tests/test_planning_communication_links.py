from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command


def test_task_communication_link_opens_exact_thread_and_fails_closed(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    finance = auth(client, "finance", "finance123")
    for module in ("communications.core", "calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text
    suffix = uuid4().hex[:8]
    thread = command(
        client,
        ops,
        "CreateCommunicationThread",
        {"title": f"Task control room {suffix}", "context_type": "planning.task", "context_id": f"task-context-{suffix}"},
        f"planning-thread-source-{suffix}",
    )
    thread_id = thread.json()["result"]["id"]
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Thread links {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"planning-thread-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    task = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Thread-linked task", "start": "2026-08-03", "end": "2026-08-05"},
        f"planning-thread-task-{suffix}",
    )
    task_id = task.json()["result"]["id"]
    before = _schedule(client, ops, project_id)
    linked = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**ops, "Idempotency-Key": f"planning-thread-link-{suffix}", "If-Match": before.headers["ETag"]},
        json={
            "scope_type": "task",
            "task_id": task_id,
            "relationship": "discussed_in",
            "target": {"kind": "communication_thread", "id": thread_id},
        },
    )
    assert linked.status_code == 200, linked.text
    body = linked.json()
    assert body["target"] == {
        "kind": "communication_thread",
        "id": thread_id,
        "resolver": "kconnect.thread",
        "resolver_version": "1",
    }
    assert body["resolution"]["status"] == "ready"
    assert body["resolution"]["display_label"] == f"Task control room {suffix}"
    assert body["resolution"]["open_path"] == f"/?view=communications&thread_id={thread_id}"

    hidden = _schedule(client, finance, project_id).json()["links"][0]
    assert hidden["resolution"]["status"] == "denied"
    assert hidden["target"]["id"] is None
    assert hidden["resolution"]["display_label"] is None
    assert hidden["resolution"]["open_path"] is None

    archived = client.delete(
        f"/api/communications/threads/{thread_id}",
        headers={**ops, "If-Match": thread.json()["result"]["etag"]},
    )
    assert archived.status_code == 200, archived.text
    retained = _schedule(client, ops, project_id).json()["links"][0]
    assert retained["id"] == body["id"]
    assert retained["target"]["id"] == thread_id
    assert retained["resolution"]["status"] == "unavailable"
    assert retained["resolution"]["open_path"] is None

    restored = client.post(
        f"/api/communications/threads/{thread_id}/restore",
        headers={**ops, "If-Match": archived.json()["etag"]},
    )
    assert restored.status_code == 200, restored.text
    ready_again = _schedule(client, ops, project_id).json()["links"][0]
    assert ready_again["id"] == body["id"]
    assert ready_again["target"]["id"] == thread_id
    assert ready_again["resolution"]["status"] == "ready"
    assert ready_again["resolution"]["open_path"] == f"/?view=communications&thread_id={thread_id}"

    assert client.post("/api/modules/communications.core/disable", headers=admin).status_code == 200
    unavailable = _schedule(client, ops, project_id).json()["links"][0]
    assert unavailable["id"] == body["id"]
    assert unavailable["resolution"]["status"] == "unavailable"
    assert unavailable["resolution"]["open_path"] is None
    assert client.post("/api/modules/communications.core/enable", headers=admin).status_code == 200
    assert _schedule(client, ops, project_id).json()["links"][0]["resolution"]["status"] == "ready"


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response
