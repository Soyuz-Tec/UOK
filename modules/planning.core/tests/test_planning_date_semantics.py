from __future__ import annotations

from datetime import timezone
from json import loads
from pathlib import Path
from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import EventRecord, PlanningScheduleEvent, PlanningTask
from uok_planning_core._internal.scheduling.date_semantics import parse_execution_date


def test_planned_forecast_actual_and_deadline_dates_are_distinct_and_audited(client: TestClient) -> None:
    ops, viewer = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Date semantics {suffix}",
        "start": "2026-03-01",
        "end": "2026-03-31",
        "timezone": "America/New_York",
    }, f"date-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id,
        "title": "Observe execution",
        "start": "2026-03-06",
        "end": "2026-03-10",
    }, f"date-task-{suffix}")
    assert task.status_code == 200, task.text
    task_id = task.json()["result"]["id"]
    before = _schedule(client, ops, project_id)

    updated = client.patch(
        f"/api/planning/tasks/{task_id}/dates",
        headers={**ops, "Idempotency-Key": f"date-update-{suffix}", "If-Match": before.headers["ETag"]},
        json={
            "forecast_start": "2026-03-08",
            "forecast_end": "2026-03-10",
            "actual_start": "2026-03-07",
            "actual_end": "2026-03-09",
            "deadline": "2026-03-09",
            "reason": "Observed start and finish from the operating record.",
        },
    )
    assert updated.status_code == 200, updated.text
    correlation_id = updated.json()["correlation_id"]
    row = updated.json()["task"]
    assert updated.json()["revision"] == before.json()["project"]["revision"] + 1
    assert row["version"] == task.json()["result"]["version"] + 1
    assert row["planned_start"] == row["start"] == "2026-03-06"
    assert row["planned_end"] == row["end"] == "2026-03-10"
    assert row["forecast_start_variance_days"] == 2
    assert row["forecast_end_variance_days"] == 0
    assert row["actual_start_variance_days"] == 1
    assert row["actual_end_variance_days"] == -1
    assert row["deadline_variance_days"] == 1
    _assert_date_storage_and_audit(task_id, project_id, correlation_id)

    schedule = _schedule(client, ops, project_id)
    body = schedule.json()
    assert body["project"]["timezone"] == "America/New_York"
    assert body["date_semantics"] == {
        "precision": "calendar_date",
        "project_timezone": "America/New_York",
        "storage_timezone": "UTC",
        "planned": {"fields": ["start", "end"], "authority": "scheduler"},
        "forecast": {"fields": ["forecast_start", "forecast_end"], "authority": "planner"},
        "actual": {"fields": ["actual_start", "actual_end"], "authority": "explicit_fact_with_reason"},
        "deadline": {"fields": ["deadline"], "authority": "planner_commitment"},
        "subday_scales": "visual_only",
    }
    baseline = client.post(
        f"/api/planning/projects/{project_id}/baselines",
        headers={**ops, "Idempotency-Key": f"date-baseline-{suffix}", "If-Match": schedule.headers["ETag"]},
        json={"name": "Execution truth"},
    )
    assert baseline.status_code == 200, baseline.text
    baseline_id = baseline.json()["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    snapshot = detail.json()["snapshot"]
    assert snapshot["project"]["timezone"] == "America/New_York"
    assert snapshot["date_semantics"]["subday_scales"] == "visual_only"
    assert snapshot["tasks"][0]["actual_start"] == "2026-03-07"
    assert detail.json()["integrity"]["verified"] is True
    schedule = _schedule(client, ops, project_id)
    denied = client.patch(
        f"/api/planning/tasks/{task_id}/dates",
        headers={**viewer, "Idempotency-Key": f"date-viewer-{suffix}", "If-Match": _schedule(client, viewer, project_id).headers["ETag"]},
        json={"forecast_end": "2026-03-11"},
    )
    assert denied.status_code == 403, denied.text

    moved = client.patch(
        f"/api/planning/tasks/{task_id}",
        headers={**ops, "Idempotency-Key": f"date-plan-move-{suffix}", "If-Match": schedule.headers["ETag"]},
        json={"start": "2026-03-11", "end": "2026-03-12"},
    )
    assert moved.status_code == 200, moved.text
    moved_row = _schedule(client, ops, project_id).json()["tasks"][0]
    assert moved_row["start"] == "2026-03-11"
    assert moved_row["actual_start"] == "2026-03-07"
    assert moved_row["actual_end"] == "2026-03-09"
    assert moved_row["deadline"] == "2026-03-09"


def test_actual_corrections_require_reason_and_date_order(client: TestClient) -> None:
    ops, _ = _planning_users(client)
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Actual corrections {suffix}", "start": "2026-11-01", "end": "2026-11-30", "timezone": "America/New_York",
    }, f"actual-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Correct facts", "start": "2026-11-02", "end": "2026-11-06",
    }, f"actual-task-{suffix}")
    task_id = task.json()["result"]["id"]
    etag = _schedule(client, ops, project_id).headers["ETag"]

    missing_reason = client.patch(
        f"/api/planning/tasks/{task_id}/dates",
        headers={**ops, "Idempotency-Key": f"actual-no-reason-{suffix}", "If-Match": etag},
        json={"actual_start": "2026-11-03"},
    )
    assert missing_reason.status_code == 400, missing_reason.text
    assert missing_reason.json()["error"]["code"] == "planning_actual_reason_required"
    assert _schedule(client, ops, project_id).headers["ETag"] == etag

    invalid_order = client.patch(
        f"/api/planning/tasks/{task_id}/dates",
        headers={**ops, "Idempotency-Key": f"actual-order-{suffix}", "If-Match": etag},
        json={"actual_start": "2026-11-05", "actual_end": "2026-11-03", "reason": "Correction"},
    )
    assert invalid_order.status_code == 400, invalid_order.text
    assert invalid_order.json()["error"]["code"] == "planning_actual_order_invalid"


def test_project_timezone_is_iana_valid_and_dst_storage_is_deterministic() -> None:
    spring = parse_execution_date("2026-03-08", "forecast_start", "America/New_York")
    fall = parse_execution_date("2026-11-01", "forecast_start", "America/New_York")
    assert spring is not None and spring.isoformat() == "2026-03-08T05:00:00+00:00"
    assert fall is not None and fall.isoformat() == "2026-11-01T04:00:00+00:00"
    try:
        parse_execution_date("20260308", "forecast_start", "America/New_York")
    except ValueError as exc:
        assert "YYYY-MM-DD" in str(exc)
    else:
        raise AssertionError("compact ISO dates must not bypass the documented contract")


def test_invalid_project_timezone_is_rejected_with_structured_repair(client: TestClient) -> None:
    ops, _ = _planning_users(client)
    suffix = uuid4().hex[:8]
    invalid = command(client, ops, "CreatePlanningProject", {
        "name": f"Invalid timezone {suffix}", "start": "2026-08-01", "end": "2026-08-10", "timezone": "Mars/Olympus",
    }, f"invalid-timezone-{suffix}")
    assert invalid.status_code == 400, invalid.text
    assert invalid.json()["error"]["code"] == "planning_validation_failed"
    assert invalid.json()["error"]["field"] == "timezone"
    assert invalid.json()["error"]["repair"]


def test_date_semantics_migration_and_manifest_are_module_owned() -> None:
    root = Path(__file__).parents[1]
    sql = (root / "migrations" / "006_planning_date_semantics.sql").read_text(encoding="utf-8")
    manifest = (root / "manifest.yaml").read_text(encoding="utf-8")
    for column in ("timezone", "forecast_start_at", "forecast_end_at", "actual_start_at", "actual_end_at", "deadline_at"):
        assert column in sql
    for constraint in ("ck_planning_projects_timezone_nonempty", "ck_planning_tasks_forecast_order", "ck_planning_tasks_actual_start_required", "ck_planning_tasks_actual_order"):
        assert constraint in sql
    for value in ("UpdatePlanningTaskDates", "PlanningTaskDatesUpdated"):
        assert value in manifest


def _planning_users(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    for module in ("calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text
    return auth(client, "ops", "ops123"), auth(client, "viewer", "viewer123")


def _schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def _assert_date_storage_and_audit(task_id: str, project_id: str, correlation_id: str) -> None:
    with SessionLocal() as db:
        task = db.get(PlanningTask, task_id)
        module_event = db.scalar(select(EventRecord).where(EventRecord.event_type == "PlanningTaskDatesUpdated", EventRecord.object_id == task_id))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(PlanningScheduleEvent.event_type == "task_dates_updated", PlanningScheduleEvent.project_id == project_id))
        assert task is not None
        forecast_start = task.forecast_start_at.replace(tzinfo=timezone.utc) if task.forecast_start_at and task.forecast_start_at.tzinfo is None else task.forecast_start_at
        deadline = task.deadline_at.replace(tzinfo=timezone.utc) if task.deadline_at and task.deadline_at.tzinfo is None else task.deadline_at
        assert forecast_start is not None and forecast_start.isoformat() == "2026-03-08T05:00:00+00:00"
        assert deadline is not None and deadline.isoformat() == "2026-03-09T04:00:00+00:00"
        assert module_event is not None and loads(module_event.payload_json)["correlation_id"] == correlation_id
        assert schedule_event is not None and loads(schedule_event.payload_json)["correlation_id"] == correlation_id
