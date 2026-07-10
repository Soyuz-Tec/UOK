from __future__ import annotations

from datetime import datetime, timezone
from time import perf_counter
from uuid import uuid4

from sqlalchemy import event, select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal, engine
from uok.models import Membership, Organization, PlanningProject, PlanningTask
from uok.security import Actor
from uok_planning_core.portfolio import planning_portfolio_read_model


def test_portfolio_is_actor_scoped_filterable_and_explainable(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    assert client.post("/api/modules/calendar.core/install", headers=admin).status_code == 200
    assert client.post("/api/modules/planning.core/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    alpha_id, task_id = _project_with_task(client, ops, f"Portfolio alpha {suffix}", suffix, "blocked")
    beta_id, _ = _project_with_task(client, ops, f"Portfolio beta {suffix}", suffix, "complete")
    command(client, ops, "CreatePlanningTaskRequirement", {
        "project_id": alpha_id, "task_id": task_id, "requirement_type": "approval",
        "title": "Portfolio approval", "required": True,
    }, f"portfolio-requirement-{suffix}")
    with SessionLocal() as db:
        task = db.get(PlanningTask, task_id)
        assert task is not None
        task.deadline_at = datetime(2020, 1, 1, tzinfo=timezone.utc)
        other = Organization(name=f"Portfolio other {suffix}")
        db.add(other)
        db.flush()
        db.add(PlanningProject(
            organization_id=other.id, name=f"Portfolio hidden {suffix}", status="active",
            start_at=datetime(2027, 1, 1, tzinfo=timezone.utc), end_at=datetime(2027, 2, 1, tzinfo=timezone.utc),
        ))
        db.commit()

    response = client.get(f"/api/planning/portfolio?query={suffix}&limit=10", headers=viewer)
    assert response.status_code == 200, response.text
    assert response.headers["Cache-Control"] == "private, no-store"
    assert response.headers["Server-Timing"].startswith("planning-portfolio;dur=")
    body = response.json()
    assert body["total"] == 2
    assert {row["id"] for row in body["projects"]} == {alpha_id, beta_id}
    assert all("hidden" not in row["name"] for row in body["projects"])
    alpha = next(row for row in body["projects"] if row["id"] == alpha_id)
    assert alpha["metrics"]["blocked_task_count"] == 1
    assert alpha["attention"] == {
        "health": "blocked", "overdue_task_count": 1, "gate_blocker_count": 1,
        "unavailable_blocking_link_count": 0, "project_overdue": False, "issue_count": 3,
    }
    assert body["summary"]["at_risk_project_count"] == 1
    assert body["diagnostics"]["query_count"] == 6
    paged = client.get(f"/api/planning/portfolio?query={suffix}&status=active&limit=1&offset=1", headers=ops)
    assert paged.status_code == 200 and paged.json()["total"] == 2 and len(paged.json()["projects"]) == 1


def test_portfolio_query_count_and_runtime_are_bounded(client: TestClient) -> None:
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8]
    _project_with_task(client, ops, f"Portfolio bounded {suffix}", suffix, "planned")
    with SessionLocal() as db:
        membership = db.scalars(select(Membership).where(Membership.role == "ops_manager")).first()
        assert membership is not None
        actor = Actor(membership.user_id, membership.user.username, membership.organization_id, membership.role)
        statements = 0

        def count_statement(*_args: object) -> None:
            nonlocal statements
            statements += 1

        event.listen(engine, "before_cursor_execute", count_statement)
        started = perf_counter()
        try:
            result = planning_portfolio_read_model(db, actor, suffix, limit=50)
        finally:
            event.remove(engine, "before_cursor_execute", count_statement)
        elapsed_ms = (perf_counter() - started) * 1000
    assert result["diagnostics"]["strategy"] == "bounded_aggregate_v1"
    assert statements == result["diagnostics"]["query_count"] == 6
    assert elapsed_ms < 500


def _project_with_task(client: TestClient, headers: dict[str, str], name: str, suffix: str, status: str) -> tuple[str, str]:
    project = command(client, headers, "CreatePlanningProject", {
        "name": name, "start": "2027-01-04", "end": "2027-12-31",
    }, f"portfolio-project-{status}-{suffix}-{uuid4().hex[:4]}")
    project_id = project.json()["result"]["id"]
    task = command(client, headers, "CreatePlanningTask", {
        "project_id": project_id, "title": f"{status.title()} portfolio task",
        "start": "2027-01-04", "end": "2027-01-04",
    }, f"portfolio-task-{status}-{suffix}-{uuid4().hex[:4]}")
    task_id = task.json()["result"]["id"]
    if status != "planned":
        updated = command(client, headers, "UpdatePlanningTask", {
            "project_id": project_id, "task_id": task_id, "status": status,
            **({"progress": 100} if status == "complete" else {}),
        }, f"portfolio-status-{status}-{suffix}-{uuid4().hex[:4]}")
        assert updated.status_code == 200, updated.text
    return project_id, task_id
