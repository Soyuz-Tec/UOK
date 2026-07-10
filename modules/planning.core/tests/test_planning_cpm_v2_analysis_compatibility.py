from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

import pytest
from sqlalchemy import text
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok_planning_core.optimizer_engine import run_optimizer
from uok_planning_core.risk_engine import run_risk_engine


def test_legacy_cpm_snapshot_requires_resnapshot_for_risk_and_optimization(client: TestClient) -> None:
    ops, project_id, task_ids, snapshot_id, _ = _setup(client)
    snapshot = client.get(
        f"/api/planning/projects/{project_id}/what-if-snapshots/{snapshot_id}", headers=ops,
    ).json()["snapshot"]
    legacy = deepcopy(snapshot)
    legacy["approved"]["calculation"]["engine_version"] = "uok-cpm-1"

    with pytest.raises(ValueError, match="uok-cpm-2 snapshot.*new what-if snapshot"):
        run_optimizer(legacy, {"timeout_ms": 500, "max_candidates": 10})
    with pytest.raises(ValueError, match="uok-cpm-2 snapshot.*new what-if snapshot"):
        run_risk_engine(legacy, {
            "seed": 1, "iterations": 100,
            "task_risks": [{
                "task_id": task_ids[0], "minimum_days": 2, "most_likely_days": 3, "maximum_days": 4,
            }],
        })


def test_legacy_approved_recommendation_cannot_apply_but_applied_can_rollback(client: TestClient) -> None:
    ops, project_id, _, snapshot_id, suffix = _setup(client)
    first = _optimization(client, ops, project_id, snapshot_id, f"legacy-opt-first-{suffix}")
    second = _optimization(client, ops, project_id, snapshot_id, f"legacy-opt-second-{suffix}")
    for index, recommendation in enumerate((first, second), start=1):
        approved = command(client, ops, "DecidePlanningRecommendation", {
            "project_id": project_id, "recommendation_id": recommendation["id"],
            "decision": "approve", "reason": "Owner approved",
        }, f"legacy-opt-approve-{index}-{suffix}")
        assert approved.status_code == 200, approved.text

    with SessionLocal() as db:
        db.execute(text("UPDATE planning_analysis_runs SET engine_version = '1' WHERE id = :id"), {
            "id": first["analysis_run_id"],
        })
        db.commit()
    rejected = command(client, ops, "ApplyPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": first["id"],
    }, f"legacy-opt-rejected-{suffix}")
    assert rejected.status_code == 400
    assert "legacy recommendation" in rejected.text and "rerun optimization" in rejected.text

    applied = command(client, ops, "ApplyPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": second["id"],
    }, f"legacy-opt-apply-{suffix}")
    assert applied.status_code == 200, applied.text
    with SessionLocal() as db:
        db.execute(text("UPDATE planning_analysis_runs SET engine_version = '1' WHERE id = :id"), {
            "id": second["analysis_run_id"],
        })
        db.commit()
    rolled_back = command(client, ops, "RollbackPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": second["id"],
    }, f"legacy-opt-rollback-{suffix}")
    assert rolled_back.status_code == 200, rolled_back.text
    assert rolled_back.json()["result"]["recommendation"]["status"] == "rolled_back"


def _setup(client: TestClient) -> tuple[dict[str, str], str, list[str], str, str]:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"CPM v2 {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"cpm-v2-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task_ids = []
    for index, (start, end) in enumerate((("2026-08-03", "2026-08-05"), ("2026-08-06", "2026-08-10")), start=1):
        task = command(client, ops, "CreatePlanningTask", {
            "project_id": project_id, "title": f"CPM v2 task {index}", "start": start, "end": end,
        }, f"cpm-v2-task-{index}-{suffix}")
        task_ids.append(task.json()["result"]["id"])
    linked = command(client, ops, "LinkPlanningTasks", {
        "project_id": project_id, "predecessor_task_id": task_ids[0], "successor_task_id": task_ids[1],
    }, f"cpm-v2-link-{suffix}")
    assert linked.status_code == 200, linked.text
    snapshot = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id, "name": "CPM v2 source", "task_changes": [{"task_id": task_ids[0], "progress": 5}],
    }, f"cpm-v2-snapshot-{suffix}")
    return ops, project_id, task_ids, snapshot.json()["result"]["what_if_snapshot"]["id"], suffix


def _optimization(client: TestClient, ops: dict[str, str], project_id: str, snapshot_id: str, key: str) -> dict:
    response = command(client, ops, "RunPlanningOptimization", {
        "project_id": project_id, "snapshot_id": snapshot_id, "timeout_ms": 500, "max_candidates": 10,
    }, key)
    assert response.status_code == 200, response.text
    return response.json()["result"]["optimization"]["recommendations"][0]
