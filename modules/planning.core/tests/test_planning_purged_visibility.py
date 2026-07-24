from __future__ import annotations

from uuid import uuid4

from sqlalchemy import func, select, text
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningOutboxEvent, PlanningScheduleEvent, PlanningScheduleRevision


def test_purged_project_hides_all_public_schedule_and_analysis_reads(client: TestClient) -> None:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project_payload = {
        "name": f"Purged visibility {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }
    project_key = f"purged-project-{suffix}"
    project = command(client, ops, "CreatePlanningProject", project_payload, project_key)
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Purged task", "start": "2026-08-03", "end": "2026-08-07",
    }, f"purged-task-{suffix}")
    task_id = task.json()["result"]["id"]
    baseline = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Before purge",
    }, f"purged-baseline-{suffix}")
    baseline_id = baseline.json()["result"]["baselines"][0]["id"]
    snapshot = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id, "name": "Before purge", "task_changes": [{"task_id": task_id, "progress": 5}],
    }, f"purged-snapshot-{suffix}")
    snapshot_id = snapshot.json()["result"]["what_if_snapshot"]["id"]
    risk = command(client, ops, "RunPlanningRiskAnalysis", {
        "project_id": project_id, "snapshot_id": snapshot_id, "seed": 7, "iterations": 100,
        "task_risks": [{"task_id": task_id, "minimum_days": 3, "most_likely_days": 5, "maximum_days": 7}],
    }, f"purged-risk-{suffix}")
    risk_id = risk.json()["result"]["risk_analysis"]["id"]
    optimization = command(client, ops, "RunPlanningOptimization", {
        "project_id": project_id, "snapshot_id": snapshot_id, "timeout_ms": 500, "max_candidates": 10,
    }, f"purged-optimization-{suffix}")
    optimization_body = optimization.json()["result"]["optimization"]
    optimization_id = optimization_body["id"]
    recommendation_id = optimization_body["recommendations"][0]["id"]

    with SessionLocal() as db:
        evidence_counts = _evidence_counts(db, project_id)
        db.execute(text("UPDATE planning_projects SET status = 'purged' WHERE id = :id"), {"id": project_id})
        db.commit()

    replay = command(client, ops, "CreatePlanningProject", project_payload, project_key)
    assert replay.status_code == 400 and replay.json()["error"]["code"] == "planning_object_not_found"
    with SessionLocal() as db:
        assert _evidence_counts(db, project_id) == evidence_counts

    denied = [
        f"/api/planning/projects/{project_id}/schedule",
        f"/api/planning/projects/{project_id}/baselines/{baseline_id}",
        f"/api/planning/projects/{project_id}/baselines/compare?left_baseline_id={baseline_id}&right_baseline_id={baseline_id}",
        f"/api/planning/projects/{project_id}/what-if-snapshots",
        f"/api/planning/projects/{project_id}/what-if-snapshots/{snapshot_id}",
        f"/api/planning/projects/{project_id}/risk-analyses",
        f"/api/planning/projects/{project_id}/risk-analyses/{risk_id}",
        f"/api/planning/projects/{project_id}/optimizations",
        f"/api/planning/projects/{project_id}/optimizations/{optimization_id}",
        f"/api/planning/projects/{project_id}/recommendations",
    ]
    for path in denied:
        response = client.get(path, headers=ops)
        assert response.status_code == 400, (path, response.text)
        assert "not found" in response.text
    assert client.get(f"/api/planning/projects/{project_id}/revisions", headers=ops).status_code == 404
    assert all(row["id"] != project_id for row in client.get("/api/planning/projects", headers=ops).json())
    assert all(row["id"] != project_id for row in client.get("/api/planning/portfolio", headers=ops).json()["projects"])
    assert recommendation_id


def _evidence_counts(db, project_id: str) -> tuple[int, int, int]:
    return tuple(int(db.scalar(select(func.count()).select_from(model).where(model.project_id == project_id)) or 0) for model in (
        PlanningScheduleEvent, PlanningScheduleRevision, PlanningOutboxEvent,
    ))
