from __future__ import annotations

from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import PlanningWhatIfSnapshot


def test_what_if_snapshot_is_immutable_verified_and_does_not_mutate_schedule(client: TestClient) -> None:
    _, ops, _, project_id, task_id, suffix = _setup(client)
    before_response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    before = before_response.json()
    before_task = next(task for task in before["tasks"] if task["id"] == task_id)
    response = client.post(
        f"/api/planning/projects/{project_id}/what-if-snapshots",
        headers={**ops, "If-Match": before_response.headers["ETag"], "Idempotency-Key": f"what-if-{suffix}"},
        json={
            "name": "Earlier delivery",
            "task_changes": [{"task_id": task_id, "start": "2026-08-05", "end": "2026-08-07", "progress": 40}],
        },
    )

    assert response.status_code == 200, response.text
    metadata = response.json()["what_if_snapshot"]
    assert metadata["source_revision"] == before["project"]["revision"]
    assert metadata["integrity"]["verified"] is True
    assert len(metadata["checksum"]) == 64

    detail = client.get(
        f"/api/planning/projects/{project_id}/what-if-snapshots/{metadata['id']}", headers=ops,
    ).json()
    assert detail["snapshot"]["proposal"]["temporary"] is True
    approved_task = next(task for task in detail["snapshot"]["approved"]["tasks"] if task["id"] == task_id)
    preview_task = next(task for task in detail["snapshot"]["preview"]["tasks"] if task["id"] == task_id)
    assert approved_task["start"] == before_task["start"]
    assert preview_task == {"id": task_id, "start": "2026-08-05", "end": "2026-08-07", "duration_days": 3, "progress": 40}

    after = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    after_task = next(task for task in after["tasks"] if task["id"] == task_id)
    assert after_task["start"] == before_task["start"]
    assert after_task["end"] == before_task["end"]
    assert after_task["progress"] == before_task["progress"]
    assert after_task["version"] == before_task["version"]
    assert after["project"]["revision"] == before["project"]["revision"] + 1

    rows = client.get(f"/api/planning/projects/{project_id}/what-if-snapshots", headers=ops).json()
    assert rows[0]["id"] == metadata["id"]
    assert rows[0]["integrity"]["verified"] is True

    with SessionLocal() as db:
        row = db.get(PlanningWhatIfSnapshot, metadata["id"])
        assert row is not None
        row.name = "Mutation attempt"
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.commit()
        db.rollback()
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.delete(row)
            db.commit()
        db.rollback()

def test_what_if_snapshot_is_idempotent_and_analysis_permission_is_enforced(client: TestClient) -> None:
    _, ops, viewer, project_id, task_id, suffix = _setup(client)
    payload = {
        "project_id": project_id,
        "name": "Permission proof",
        "task_changes": [{"task_id": task_id, "end": "2026-08-10"}],
    }
    denied = command(client, viewer, "CreatePlanningWhatIfSnapshot", payload, f"what-if-denied-{suffix}")
    assert denied.status_code == 403
    assert "planning.analyze" in denied.text

    first = command(client, ops, "CreatePlanningWhatIfSnapshot", payload, f"what-if-replay-{suffix}")
    replay = command(client, ops, "CreatePlanningWhatIfSnapshot", payload, f"what-if-replay-{suffix}")
    assert first.status_code == 200, first.text
    assert replay.status_code == 200, replay.text
    assert replay.json()["idempotent"] is True
    assert replay.json()["result"]["what_if_snapshot"]["id"] == first.json()["result"]["what_if_snapshot"]["id"]

    rejected = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id,
        "name": "Duplicate changes",
        "task_changes": [{"task_id": task_id, "progress": 10}, {"task_id": task_id, "progress": 20}],
    }, f"what-if-duplicate-{suffix}")
    assert rejected.status_code == 400
    assert "unique task_id" in rejected.text


def _setup(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str], str, str, str]:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"What-if {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"what-if-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id,
        "title": "Approved work",
        "start": "2026-08-10",
        "end": "2026-08-12",
        "progress": 10,
    }, f"what-if-task-{suffix}")
    return admin, ops, viewer, project_id, task.json()["result"]["id"], suffix
