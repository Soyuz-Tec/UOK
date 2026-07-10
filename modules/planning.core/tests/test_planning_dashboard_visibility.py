from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import delete, select
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.db import SessionLocal
from uok.models import Membership, Organization, PlanningProject, PlanningTask


def test_dashboard_excludes_tasks_with_hidden_or_cross_org_parent_projects(client: TestClient) -> None:
    ops = auth(client, "ops", "ops123")
    before_response = client.get("/api/dashboard", headers=ops)
    assert before_response.status_code == 200, before_response.text
    before = before_response.json()["counts"]

    suffix = uuid4().hex[:8]
    start = datetime(2027, 1, 4, tzinfo=timezone.utc)
    finish = datetime(2027, 1, 8, tzinfo=timezone.utc)
    with SessionLocal() as db:
        membership = db.scalars(select(Membership).where(Membership.role == "ops_manager")).first()
        assert membership is not None
        organization_id = membership.organization_id
        other_organization = Organization(name=f"Dashboard other organization {suffix}")
        visible_project = _project(organization_id, f"Dashboard visible {suffix}", "active", start, finish)
        purged_project = _project(organization_id, f"Dashboard purged {suffix}", "purged", start, finish)
        other_project = _project("", f"Dashboard other project {suffix}", "active", start, finish)
        db.add_all((other_organization, visible_project, purged_project))
        db.flush()
        other_project.organization_id = other_organization.id
        db.add(other_project)
        db.flush()

        tasks = (
            _task(organization_id, visible_project.id, f"Dashboard visible task {suffix}", start, finish),
            _task(organization_id, purged_project.id, f"Dashboard purged task {suffix}", start, finish),
            _task(organization_id, other_project.id, f"Dashboard cross-org task {suffix}", start, finish),
            _task(other_organization.id, other_project.id, f"Dashboard other task {suffix}", start, finish),
        )
        db.add_all(tasks)
        db.commit()
        task_ids = tuple(task.id for task in tasks)
        project_ids = (visible_project.id, purged_project.id, other_project.id)
        other_organization_id = other_organization.id

    try:
        response = client.get("/api/dashboard", headers=ops)
        assert response.status_code == 200, response.text
        counts = response.json()["counts"]
        assert counts["planning_projects"] == before["planning_projects"] + 1
        assert counts["planning_tasks"] == before["planning_tasks"] + 1
    finally:
        with SessionLocal() as db:
            db.execute(delete(PlanningTask).where(PlanningTask.id.in_(task_ids)))
            db.execute(delete(PlanningProject).where(PlanningProject.id.in_(project_ids)))
            db.execute(delete(Organization).where(Organization.id == other_organization_id))
            db.commit()


def _project(
    organization_id: str,
    name: str,
    status: str,
    start: datetime,
    finish: datetime,
) -> PlanningProject:
    return PlanningProject(
        organization_id=organization_id,
        name=name,
        status=status,
        start_at=start,
        end_at=finish,
        target_finish_at=finish,
        calculated_finish_at=finish,
    )


def _task(
    organization_id: str,
    project_id: str,
    title: str,
    start: datetime,
    finish: datetime,
) -> PlanningTask:
    return PlanningTask(
        organization_id=organization_id,
        project_id=project_id,
        title=title,
        start_at=start,
        end_at=finish,
        duration_days=5,
    )
