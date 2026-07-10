from __future__ import annotations

from copy import deepcopy
from unittest.mock import patch
from uuid import uuid4

import pytest
from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import PlanningAnalysisRecommendation, PlanningScheduleEvent
from uok.util import loads
from uok_planning_core.optimizer_engine import run_optimizer


def test_bounded_optimizer_returns_explained_independently_validated_candidate(client: TestClient) -> None:
    _, ops, _, project_id, task_ids, snapshot_id, _ = _setup(client)
    snapshot = _snapshot(client, ops, project_id, snapshot_id)

    inputs, limits, result = run_optimizer(snapshot, {
        "objective": "minimize_project_finish", "timeout_ms": 500, "max_candidates": 10,
    })

    assert inputs == {"objective": "minimize_project_finish", "timeout_ms": 500, "max_candidates": 10}
    assert limits["evaluated_candidates"] >= 1
    assert result["status"] == "completed"
    assert result["independent_validation"] == {"ok": True, "violations": []}
    recommendation = result["recommendations"][0]
    assert recommendation["rank"] == 1
    assert recommendation["objective"]["improvement_working_days"] >= 1
    assert recommendation["preview"]["validation"]["ok"] is True
    assert recommendation["explanation"]["impact"]
    assert recommendation["explanation"]["side_effects"]
    assert recommendation["explanation"]["assumptions"]
    assert recommendation["proposal"]["task_changes"][0]["task_id"] in task_ids


def test_optimizer_reports_timeout_and_infeasible_without_false_success(client: TestClient) -> None:
    _, ops, _, project_id, _, snapshot_id, _ = _setup(client)
    snapshot = _snapshot(client, ops, project_id, snapshot_id)
    with patch("uok_planning_core.optimizer_engine.monotonic", side_effect=[0.0, 0.002]):
        _, limits, timed_out = run_optimizer(snapshot, {"timeout_ms": 1, "max_candidates": 10})
    assert timed_out["status"] == "timeout"
    assert limits["evaluated_candidates"] == 0
    assert "time_limit_reached" in {row["code"] for row in timed_out["explanations"]}
    assert timed_out["independent_validation"]["ok"] is True

    infeasible_snapshot = deepcopy(snapshot)
    for task in infeasible_snapshot["approved"]["tasks"]:
        if task["task_type"] == "task":
            task["duration_days"] = 1
    for task in infeasible_snapshot["preview"]["tasks"]:
        task["duration_days"] = 1
    _, _, infeasible = run_optimizer(infeasible_snapshot, {"timeout_ms": 500, "max_candidates": 10})
    assert infeasible["status"] == "infeasible"
    assert infeasible["recommendations"] == []
    assert "no_compressible_auto_task" in {row["code"] for row in infeasible["explanations"]}


def test_recommendation_requires_approval_applies_audits_and_rolls_back(client: TestClient) -> None:
    _, ops, viewer, project_id, _, snapshot_id, suffix = _setup(client)
    optimized = command(client, ops, "RunPlanningOptimization", {
        "project_id": project_id, "snapshot_id": snapshot_id,
        "objective": "minimize_project_finish", "timeout_ms": 500, "max_candidates": 10,
    }, f"optimization-{suffix}")
    assert optimized.status_code == 200, optimized.text
    metadata = optimized.json()["result"]["optimization"]
    assert metadata["status"] == "completed"
    assert metadata["engine"] == {"name": "uok-bounded-schedule-optimizer", "version": "2"}
    assert metadata["integrity"]["verified"] is True
    recommendation = metadata["recommendations"][0]
    change = recommendation["proposal"]["task_changes"][0]

    not_approved = command(client, ops, "ApplyPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": recommendation["id"],
    }, f"optimization-early-apply-{suffix}")
    assert not_approved.status_code == 400
    assert "must be approved" in not_approved.text

    denied = command(client, viewer, "DecidePlanningRecommendation", {
        "project_id": project_id, "recommendation_id": recommendation["id"],
        "decision": "approve", "reason": "Unauthorized",
    }, f"optimization-denied-{suffix}")
    assert denied.status_code == 403
    assert "planning.analysis.approve" in denied.text

    approved = command(client, ops, "DecidePlanningRecommendation", {
        "project_id": project_id, "recommendation_id": recommendation["id"],
        "decision": "approve", "reason": "Owner confirmed duration compression",
    }, f"optimization-approve-{suffix}")
    assert approved.status_code == 200, approved.text
    assert approved.json()["result"]["recommendation"]["status"] == "approved"

    applied = command(client, ops, "ApplyPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": recommendation["id"],
    }, f"optimization-apply-{suffix}")
    assert applied.status_code == 200, applied.text
    applied_rec = applied.json()["result"]["recommendation"]
    assert applied_rec["status"] == "applied"
    applied_task = next(row for row in applied.json()["result"]["schedule"]["tasks"] if row["id"] == change["task_id"])
    assert applied_task["end"] == change["after"]["end"]
    assert applied_rec["application"]["revision"] == applied.json()["result"]["revision"]

    rolled_back = command(client, ops, "RollbackPlanningRecommendation", {
        "project_id": project_id, "recommendation_id": recommendation["id"],
    }, f"optimization-rollback-{suffix}")
    assert rolled_back.status_code == 200, rolled_back.text
    rollback_rec = rolled_back.json()["result"]["recommendation"]
    rollback_task = next(row for row in rolled_back.json()["result"]["schedule"]["tasks"] if row["id"] == change["task_id"])
    assert rollback_rec["status"] == "rolled_back"
    assert rollback_task["end"] == change["before"]["end"]
    assert rollback_rec["rollback"]["revision"] == rolled_back.json()["result"]["revision"]
    _assert_audit_chain(project_id, optimized.json()["command_id"], approved.json()["command_id"], applied.json()["command_id"], rolled_back.json()["command_id"])


def test_recommendation_state_machine_rejects_direct_invalid_transition(client: TestClient) -> None:
    _, ops, _, project_id, _, snapshot_id, suffix = _setup(client)
    optimized = command(client, ops, "RunPlanningOptimization", {
        "project_id": project_id, "snapshot_id": snapshot_id,
    }, f"optimization-transition-{suffix}")
    recommendation_id = optimized.json()["result"]["optimization"]["recommendations"][0]["id"]
    with SessionLocal() as db:
        row = db.get(PlanningAnalysisRecommendation, recommendation_id)
        assert row is not None
        row.status = "applied"
        with pytest.raises(ValueError, match="transition proposed to applied is not allowed"):
            db.commit()
        db.rollback()


def _setup(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str], str, list[str], str, str]:
    suffix = uuid4().hex[:8]
    admin, ops, viewer = auth(client, "admin", "admin"), auth(client, "ops", "ops123"), auth(client, "viewer", "viewer123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {"name": f"Optimize {suffix}", "start": "2026-08-03", "end": "2026-08-31"}, f"opt-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task_ids = []
    for index, (start, end) in enumerate((("2026-08-03", "2026-08-05"), ("2026-08-06", "2026-08-10")), start=1):
        task = command(client, ops, "CreatePlanningTask", {"project_id": project_id, "title": f"Optimize task {index}", "start": start, "end": end}, f"opt-task-{suffix}-{index}")
        task_ids.append(task.json()["result"]["id"])
    assert command(client, ops, "LinkPlanningTasks", {"project_id": project_id, "predecessor_task_id": task_ids[0], "successor_task_id": task_ids[1]}, f"opt-link-{suffix}").status_code == 200
    snapshot = command(client, ops, "CreatePlanningWhatIfSnapshot", {"project_id": project_id, "name": "Optimization source", "task_changes": [{"task_id": task_ids[0], "progress": 5}]}, f"opt-snapshot-{suffix}")
    return admin, ops, viewer, project_id, task_ids, snapshot.json()["result"]["what_if_snapshot"]["id"], suffix


def _snapshot(client: TestClient, ops: dict[str, str], project_id: str, snapshot_id: str) -> dict:
    return client.get(f"/api/planning/projects/{project_id}/what-if-snapshots/{snapshot_id}", headers=ops).json()["snapshot"]


def _assert_audit_chain(project_id: str, *command_ids: str) -> None:
    with SessionLocal() as db:
        events = list(db.scalars(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id,
            PlanningScheduleEvent.event_type.in_(("optimization_completed", "recommendation_decided", "recommendation_applied", "recommendation_rolled_back")),
        )).all())
        correlations = {loads(row.payload_json, {})["correlation_id"] for row in events}
        assert set(command_ids) <= correlations
