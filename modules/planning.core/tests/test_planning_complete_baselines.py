from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select, update
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import EventRecord, PlanningBaseline, PlanningScheduleEvent
from uok.util import dumps, loads


def test_complete_baseline_captures_and_verifies_canonical_schedule(client: TestClient) -> None:
    ops, project_id, task_id = _schedule_with_all_facts(client)
    before = _schedule(client, ops, project_id)

    created = command(
        client,
        ops,
        "CreatePlanningBaseline",
        {"project_id": project_id, "name": "Approved control"},
        f"complete-baseline-{uuid4()}",
    )
    assert created.status_code == 200, created.text
    result = created.json()["result"]
    metadata = result["baselines"][0]
    assert result["project"]["revision"] == before["project"]["revision"] + 1
    assert metadata["schema_version"] == 2
    assert metadata["completeness"] == "complete"
    assert metadata["source_revision"] == before["project"]["revision"]
    assert len(metadata["checksum"]) == 64
    assert metadata["correlation_id"] == created.json()["command_id"]
    assert metadata["integrity"]["status"] == "verified"

    detail = client.get(
        f"/api/planning/projects/{project_id}/baselines/{metadata['id']}",
        headers=ops,
    )
    assert detail.status_code == 200, detail.text
    body = detail.json()
    snapshot = body["snapshot"]
    assert body["integrity"]["verified"] is True
    assert snapshot["schema_version"] == 2
    assert snapshot["project"]["source_revision"] == before["project"]["revision"]
    assert snapshot["project"]["timezone"] == "UTC"
    assert snapshot["creator"]["username"] == "ops"
    assert snapshot["capture"]["correlation_id"] == created.json()["command_id"]
    assert any(task["id"] == task_id and task["parent_task_id"] for task in snapshot["tasks"])
    assert snapshot["dependencies"]
    assert snapshot["calendar"]["holidays"] == ["2026-08-14"]
    assert snapshot["resources"]
    assert snapshot["assignments"]
    assert snapshot["links"] == []
    assert snapshot["calculation"]["engine_version"]
    assert snapshot["calculation"]["independent_validation"]["ok"] is True

    with SessionLocal() as db:
        event = db.scalar(select(EventRecord).where(
            EventRecord.object_id == metadata["id"],
            EventRecord.event_type == "PlanningBaselineCreated",
        ))
        schedule_event = db.scalar(select(PlanningScheduleEvent).where(
            PlanningScheduleEvent.project_id == project_id,
            PlanningScheduleEvent.event_type == "baseline_created",
        ).order_by(PlanningScheduleEvent.created_at.desc()))
        assert event is not None
        assert schedule_event is not None
        assert loads(event.payload_json)["correlation_id"] == created.json()["command_id"]
        assert loads(schedule_event.payload_json)["correlation_id"] == created.json()["command_id"]


def test_baseline_compare_reports_canonical_fact_changes(client: TestClient) -> None:
    ops, project_id, task_id = _schedule_with_all_facts(client)
    left = _create_baseline(client, ops, project_id, "Before progress")
    changed = command(
        client,
        ops,
        "UpdatePlanningTask",
        {"task_id": task_id, "progress": 65},
        f"baseline-progress-{uuid4()}",
    )
    assert changed.status_code == 200, changed.text
    right = _create_baseline(client, ops, project_id, "After progress")
    assert left["checksum"] != right["checksum"]

    compared = client.get(
        f"/api/planning/projects/{project_id}/baselines/compare",
        params={"left_baseline_id": left["id"], "right_baseline_id": right["id"]},
        headers=ops,
    )
    assert compared.status_code == 200, compared.text
    body = compared.json()
    assert body["supported"] is True
    assert body["limitations"] == []
    assert task_id in body["changes"]["tasks"]["changed"]
    assert "source_revision" in body["changes"]["project_fields"]


def test_legacy_baseline_is_partial_and_compare_fails_closed(client: TestClient) -> None:
    ops, project_id, _ = _schedule_with_all_facts(client)
    complete = _create_baseline(client, ops, project_id, "Complete v2")
    with SessionLocal() as db:
        reference = db.get(PlanningBaseline, complete["id"])
        assert reference is not None
        legacy = PlanningBaseline(
            organization_id=reference.organization_id,
            project_id=project_id,
            name="Imported legacy baseline",
            snapshot_json=dumps({"tasks": [{"id": "legacy-task", "start": "2026-08-03", "end": "2026-08-04"}]}),
            schema_version=1,
            completeness="partial",
            checksum=None,
            source_revision=None,
            created_by_user_id=None,
            correlation_id=None,
            created_at=datetime.now(timezone.utc),
        )
        db.add(legacy)
        db.commit()
        legacy_id = legacy.id

    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{legacy_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["completeness"] == "partial"
    assert detail.json()["integrity"]["status"] == "partial"
    assert "dependencies" in detail.json()["integrity"]["missing_facts"]

    compared = client.get(
        f"/api/planning/projects/{project_id}/baselines/compare",
        params={"left_baseline_id": legacy_id, "right_baseline_id": complete["id"]},
        headers=ops,
    )
    assert compared.status_code == 200, compared.text
    assert compared.json()["supported"] is False
    assert "complete v2 snapshots are required" in compared.json()["limitations"][0]


def test_baseline_rows_are_immutable_and_tampering_is_detected(client: TestClient) -> None:
    ops, project_id, _ = _schedule_with_all_facts(client)
    baseline = _create_baseline(client, ops, project_id, "Immutable")
    with SessionLocal() as db:
        row = db.get(PlanningBaseline, baseline["id"])
        assert row is not None
        row.name = "Attempted rename"
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.commit()
        db.rollback()
        row = db.get(PlanningBaseline, baseline["id"])
        assert row is not None
        snapshot = loads(row.snapshot_json)
        snapshot["project"]["name"] = "Tampered project"
        db.execute(update(PlanningBaseline).where(PlanningBaseline.id == baseline["id"]).values(snapshot_json=dumps(snapshot)))
        db.commit()

    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline['id']}", headers=ops)
    assert detail.status_code == 200, detail.text
    assert detail.json()["integrity"]["status"] == "checksum_mismatch"
    assert detail.json()["integrity"]["verified"] is False


def test_complete_baseline_migration_is_additive_and_immutable() -> None:
    text = (Path(__file__).parents[1] / "migrations" / "003_planning_complete_baselines.sql").read_text(encoding="utf-8")
    assert "ADD COLUMN IF NOT EXISTS schema_version" in text
    assert "completeness = COALESCE(completeness, 'partial')" in text
    assert "ADD COLUMN IF NOT EXISTS checksum" in text
    assert "ADD COLUMN IF NOT EXISTS source_revision" in text
    assert "ADD COLUMN IF NOT EXISTS created_by_user_id" in text
    assert "ADD COLUMN IF NOT EXISTS correlation_id" in text
    assert "BEFORE UPDATE OR DELETE ON planning_baselines" in text
    assert "DROP TABLE" not in text.upper()
    assert "TRUNCATE" not in text.upper()


def _schedule_with_all_facts(client: TestClient) -> tuple[dict[str, str], str, str]:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    suffix = str(uuid4())[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Complete baseline {suffix}", "start": "2026-08-03", "end": "2026-08-28",
    }, f"baseline-project-{suffix}")
    project_id = project.json()["result"]["id"]
    summary = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Delivery", "start": "2026-08-03", "end": "2026-08-12", "task_type": "summary",
    }, f"baseline-summary-{suffix}").json()["result"]["id"]
    first = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "parent_task_id": summary, "title": "Build", "start": "2026-08-03", "end": "2026-08-05",
        "scheduling_mode": "manual", "constraint_type": "must_start_on", "constraint_date": "2026-08-03",
    }, f"baseline-first-{suffix}").json()["result"]["id"]
    second = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "parent_task_id": summary, "title": "Review", "start": "2026-08-06", "end": "2026-08-07",
    }, f"baseline-second-{suffix}").json()["result"]["id"]
    linked = command(client, ops, "LinkPlanningTasks", {
        "project_id": project_id, "predecessor_task_id": first, "successor_task_id": second, "dependency_type": "finish_to_start", "lag_days": 0,
    }, f"baseline-link-{suffix}")
    assert linked.status_code == 200, linked.text
    calendar = command(client, ops, "SetPlanningCalendar", {
        "project_id": project_id, "name": "Control", "working_days": [1, 2, 3, 4, 5], "holidays": ["2026-08-14"],
    }, f"baseline-calendar-{suffix}")
    assert calendar.status_code == 200, calendar.text
    resource = command(client, ops, "CreatePlanningResource", {
        "project_id": project_id, "name": "Planner", "role": "Scheduling",
    }, f"baseline-resource-{suffix}")
    resource_id = resource.json()["result"]["resources"][0]["id"]
    assigned = command(client, ops, "AssignPlanningResource", {
        "task_id": first, "resource_id": resource_id, "allocation_percent": 80,
    }, f"baseline-assignment-{suffix}")
    assert assigned.status_code == 200, assigned.text
    return ops, project_id, first


def _create_baseline(client: TestClient, headers: dict[str, str], project_id: str, name: str) -> dict:
    response = command(client, headers, "CreatePlanningBaseline", {"project_id": project_id, "name": name}, f"baseline-{uuid4()}")
    assert response.status_code == 200, response.text
    return response.json()["result"]["baselines"][0]


def _schedule(client: TestClient, headers: dict[str, str], project_id: str) -> dict:
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()
