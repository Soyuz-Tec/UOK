from __future__ import annotations

from json import loads

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import CommandLog, EventRecord
from uok_planning_core._internal.persistence.models import PlanningScheduleEvent


def planning_with_reports(
    client: TestClient,
) -> tuple[dict[str, str], dict[str, str], dict[str, str], dict[str, str]]:
    admin = auth(client, "admin", "admin")
    for module in ("reports.core", "calendar.core", "planning.core"):
        response = client.post(f"/api/modules/{module}/install", headers=admin)
        assert response.status_code == 200, response.text
    return (
        admin,
        auth(client, "ops", "ops123"),
        auth(client, "trader", "trader123"),
        auth(client, "viewer", "viewer123"),
    )


def project_and_task(client: TestClient, ops: dict[str, str], suffix: str) -> tuple[str, str]:
    project = command(
        client,
        ops,
        "CreatePlanningProject",
        {"name": f"Requirements {suffix}", "start": "2026-08-03", "end": "2026-08-28"},
        f"requirement-project-{suffix}",
    )
    project_id = project.json()["result"]["id"]
    task = command(
        client,
        ops,
        "CreatePlanningTask",
        {"project_id": project_id, "title": "Controlled task", "start": "2026-08-03", "end": "2026-08-05"},
        f"requirement-task-{suffix}",
    )
    return project_id, task.json()["result"]["id"]


def report_artifact(client: TestClient, ops: dict[str, str], suffix: str) -> str:
    response = client.post(
        "/api/reports/generate",
        headers=ops,
        json={
            "source_module": "planning.core",
            "template_key": "gate.evidence",
            "formats": ["json"],
            "title": "Gate evidence",
            "filename_base": f"gate-evidence-{suffix}",
            "payload": {"verified": True},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()["artifacts"][0]["id"]


def create_evidence_link(
    client: TestClient,
    ops: dict[str, str],
    project_id: str,
    task_id: str,
    artifact_id: str,
    suffix: str,
) -> dict:
    current = schedule(client, ops, project_id)
    response = client.post(
        f"/api/planning/projects/{project_id}/links",
        headers={**ops, "Idempotency-Key": f"requirement-link-{suffix}", "If-Match": current.headers["ETag"]},
        json={
            "scope_type": "task",
            "task_id": task_id,
            "relationship": "proves",
            "target": {"kind": "evidence", "id": artifact_id},
        },
    )
    assert response.status_code == 200, response.text
    return response.json()


def requirement_mutation(
    client: TestClient,
    actor: dict[str, str],
    task_id: str,
    requirement_id: str,
    action_path: str,
    current,
    key: str,
    payload: dict,
):
    suffix = f"/{requirement_id}/{action_path}" if requirement_id else ""
    return client.post(
        f"/api/planning/tasks/{task_id}/requirements{suffix}",
        headers={**actor, "Idempotency-Key": key, "If-Match": current.headers["ETag"]},
        json=payload,
    )


def schedule(client: TestClient, headers: dict[str, str], project_id: str):
    response = client.get(f"/api/planning/projects/{project_id}/schedule", headers=headers)
    assert response.status_code == 200, response.text
    return response


def assert_requirement_correlation(
    requirement_id: str,
    command_id: str,
    project_id: str,
    event_type: str,
) -> None:
    with SessionLocal() as db:
        log = db.get(CommandLog, command_id)
        module_event = db.scalar(
            select(EventRecord).where(EventRecord.event_type == event_type, EventRecord.object_id == requirement_id)
        )
        schedule_event = db.scalar(
            select(PlanningScheduleEvent).where(
                PlanningScheduleEvent.project_id == project_id,
                PlanningScheduleEvent.payload_json.contains(command_id),
            )
        )
        assert log is not None and log.status == "succeeded"
        assert module_event is not None and loads(module_event.payload_json)["correlation_id"] == command_id
        assert schedule_event is not None and loads(schedule_event.payload_json)["correlation_id"] == command_id
