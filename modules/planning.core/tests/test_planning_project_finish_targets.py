from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningProject, PlanningTask


def test_project_target_is_exact_and_calculated_finish_is_persisted_cpm(client: TestClient) -> None:
    suffix, ops = _planning(client)
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Finish target {suffix}", "start": "2026-08-01", "end": "2026-08-09",
    }, f"finish-project-{suffix}")
    assert created.status_code == 200, created.text
    project_id = created.json()["result"]["id"]
    initial = _schedule(client, ops, project_id)
    assert initial["project"]["end"] == "2026-08-09"
    assert initial["project"]["target_finish"] == "2026-08-09"
    assert initial["project"]["calculated_finish"] == "2026-08-03"
    assert initial["calculation"]["target_finish"] == initial["project"]["target_finish"]
    assert initial["calculation"]["calculated_finish"] == initial["project"]["calculated_finish"]
    assert initial["calculation"]["engine_version"] == "uok-cpm-2"

    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Late delivery", "start": "2026-08-03", "end": "2026-08-12",
    }, f"finish-task-{suffix}")
    assert task.status_code == 200, task.text
    schedule = _schedule(client, ops, project_id)
    assert schedule["project"]["end"] == "2026-08-09"
    assert schedule["project"]["target_finish"] == "2026-08-09"
    assert schedule["project"]["calculated_finish"] == "2026-08-12"
    assert schedule["calculation"]["calculated_finish"] == schedule["project"]["calculated_finish"]
    assert schedule["calculation"]["target_finish"] == schedule["project"]["target_finish"]
    assert schedule["tasks"][0]["total_slack_days"] < 0
    with SessionLocal() as db:
        row = db.get(PlanningProject, project_id)
        assert row and row.target_finish_at.date().isoformat() == "2026-08-09"
        assert row.calculated_finish_at.date().isoformat() == schedule["calculation"]["calculated_finish"]


def test_legacy_finish_backfill_mismatch_is_visible_and_scheduler_repairs_it(client: TestClient) -> None:
    suffix, ops = _planning(client)
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"Legacy finish {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"legacy-project-{suffix}")
    project_id = created.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Stored later", "start": "2026-08-20", "end": "2026-08-21",
    }, f"legacy-task-{suffix}")
    task_id = task.json()["result"]["id"]
    healthy = _schedule_response(client, ops, project_id)
    assert healthy.json()["project"]["calculated_finish"] == "2026-08-04"

    with SessionLocal() as db:
        max_end = db.scalar(select(PlanningTask.end_at).where(PlanningTask.project_id == project_id))
        row = db.get(PlanningProject, project_id)
        assert row and max_end and max_end.date() != row.calculated_finish_at.date()
        row.calculated_finish_at = max_end
        db.commit()
    divergent = _schedule_response(client, ops, project_id)
    issues = divergent.json()["calculation"]["independent_validation"]["violations"]
    assert any(issue["code"] == "cpm_persisted_finish_mismatch" for issue in issues)
    assert divergent.json()["validation"]["ok"] is False
    baseline = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Must fail",
    }, f"legacy-baseline-{suffix}")
    what_if = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id, "name": "Must fail", "task_changes": [{"task_id": task_id, "progress": 10}],
    }, f"legacy-what-if-{suffix}")
    assert baseline.status_code == 400 and "scheduler mutation" in baseline.text
    assert what_if.status_code == 400 and "scheduler mutation" in what_if.text

    repaired = client.patch(f"/api/planning/tasks/{task_id}", headers={
        **ops, "If-Match": divergent.headers["ETag"], "Idempotency-Key": f"legacy-repair-{suffix}",
    }, json={"progress": 10})
    assert repaired.status_code == 200, repaired.text
    current = _schedule(client, ops, project_id)
    assert current["validation"]["ok"] is True
    assert current["project"]["target_finish"] == "2026-08-31"
    assert current["project"]["calculated_finish"] == current["calculation"]["calculated_finish"] == "2026-08-04"
    captured = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Repaired",
    }, f"legacy-baseline-ok-{suffix}")
    assert captured.status_code == 200, captured.text


def test_project_calendar_holiday_does_not_move_target_commitment(client: TestClient) -> None:
    suffix, ops = _planning(client)
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Holiday target {suffix}", "start": "2026-08-03", "end": "2026-08-07",
    }, f"holiday-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Holiday delivery", "start": "2026-08-03", "end": "2026-08-07",
    }, f"holiday-task-{suffix}")
    assert task.status_code == 200, task.text
    calendar = command(client, ops, "SetPlanningCalendar", {
        "project_id": project_id, "name": "Target holiday", "working_days": [1, 2, 3, 4, 5],
        "holidays": ["2026-08-07"],
    }, f"holiday-calendar-{suffix}")
    assert calendar.status_code == 200, calendar.text
    schedule = _schedule(client, ops, project_id)
    assert schedule["project"]["end"] == schedule["project"]["target_finish"] == "2026-08-07"
    assert schedule["calculation"]["target_finish"] == "2026-08-07"
    assert schedule["tasks"][0]["late_finish"] == "2026-08-06"
    assert schedule["tasks"][0]["total_slack_days"] < 0


def test_lifecycle_target_migration_is_additive_and_constrained() -> None:
    sql = Path("modules/planning.core/migrations/015_planning_project_lifecycle_targets.sql").read_text(encoding="utf-8").lower()
    for token in (
        "target_finish_at", "calculated_finish_at", "max(task.end_at)", "task.status <> 'deleted'",
        "project.start_at", "alter column target_finish_at set not null", "alter column calculated_finish_at set not null",
        "ck_planning_projects_status", "ck_planning_tasks_status", "ck_planning_projects_target_finish_order",
    ):
        assert token in sql
    assert "drop table" not in sql and "drop column" not in sql


def test_database_rejects_unknown_statuses_and_target_before_start(client: TestClient) -> None:
    suffix, ops = _planning(client)
    created = command(client, ops, "CreatePlanningProject", {
        "name": f"DB lifecycle {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"db-lifecycle-{suffix}")
    project_id = created.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "DB task", "start": "2026-08-03", "end": "2026-08-03",
    }, f"db-task-{suffix}")
    with SessionLocal() as db:
        for statement, parameters in (
            ("UPDATE planning_projects SET status = 'unknown' WHERE id = :id", {"id": project_id}),
            ("UPDATE planning_projects SET target_finish_at = '2026-08-01' WHERE id = :id", {"id": project_id}),
            ("UPDATE planning_tasks SET status = 'unknown' WHERE id = :id", {"id": task.json()["result"]["id"]}),
        ):
            with pytest.raises(IntegrityError):
                db.execute(text(statement), parameters)
                db.commit()
            db.rollback()
        row = db.get(PlanningProject, project_id)
        assert row
        row.status = "on_hold"
        with pytest.raises(ValueError, match="TransitionPlanningProject"):
            db.commit()


def _planning(client: TestClient) -> tuple[str, dict[str, str]]:
    suffix = uuid4().hex[:8]
    admin, ops = auth(client, "admin", "admin"), auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    return suffix, ops


def _schedule_response(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _schedule(client: TestClient, headers: dict[str, str], project_id: str) -> dict:
    return _schedule_response(client, headers, project_id).json()
