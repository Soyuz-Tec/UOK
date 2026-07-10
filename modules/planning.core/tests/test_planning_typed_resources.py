from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.db import SessionLocal
from uok.models import PlanningResource


def test_typed_resources_round_trip_into_schedule_and_baseline(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("contacts.core", "calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    party = command(client, ops, "CreateContact", {"display_name": f"Capacity owner {suffix}"}, f"resource-party-{suffix}")
    party_id = party.json()["result"]["contact_id"]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Typed resources {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"resource-project-{suffix}")
    project_id = project.json()["result"]["id"]
    fixtures = [
        {"name": "Planner", "resource_type": "human", "capacity_value": 0.5, "capacity_unit": "fte", "canonical_target_kind": "party", "canonical_target_id": party_id},
        {"name": "Berth team", "resource_type": "team", "capacity_value": 6, "capacity_unit": "people"},
        {"name": "Yard vehicle", "resource_type": "vehicle", "capacity_value": 2, "capacity_unit": "units"},
        {"name": "Inspection crane", "resource_type": "equipment", "capacity_value": 8, "capacity_unit": "hours_per_day"},
        {"name": "Fuel stock", "resource_type": "material", "capacity_value": 1250.5, "capacity_unit": "liters"},
        {"name": "Execution budget", "resource_type": "budget", "capacity_value": 25000, "capacity_unit": "currency"},
        {"name": "Staging site", "resource_type": "location", "capacity_value": 3, "capacity_unit": "units", "effective_start": "2026-08-05", "effective_end": "2026-08-25"},
    ]
    schedule = None
    for index, fixture in enumerate(fixtures):
        created = command(client, ops, "CreatePlanningResource", {"project_id": project_id, **fixture}, f"typed-resource-{suffix}-{index}")
        assert created.status_code == 200, created.text
        schedule = created.json()["result"]
    assert schedule is not None
    assert len(schedule["resources"]) == len(fixtures)
    by_type = {row["resource_type"]: row for row in schedule["resources"]}
    assert by_type["human"]["capacity_value"] == 0.5
    assert by_type["human"]["canonical_target_id"] == party_id
    assert by_type["human"]["canonical_resolution"]["status"] == "ready"
    assert by_type["location"]["effective_start"] == "2026-08-05"
    assert by_type["location"]["effective_end"] == "2026-08-25"

    baseline = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Typed resource baseline",
    }, f"typed-resource-baseline-{suffix}")
    assert baseline.status_code == 200, baseline.text
    baseline_id = baseline.json()["result"]["baselines"][0]["id"]
    detail = client.get(f"/api/planning/projects/{project_id}/baselines/{baseline_id}", headers=ops)
    assert detail.status_code == 200, detail.text
    snapshot_types = {row["resource_type"] for row in detail.json()["snapshot"]["resources"]}
    assert snapshot_types == {item["resource_type"] for item in fixtures}


@pytest.mark.parametrize("payload, message", [
    ({"resource_type": "vehicle", "capacity_unit": "fte"}, "capacity_unit for vehicle"),
    ({"resource_type": "human", "canonical_target_kind": "asset", "canonical_target_id": "asset-1"}, "canonical_target_kind for human"),
    ({"resource_type": "location", "canonical_target_kind": "location"}, "must be provided together"),
    ({"resource_type": "equipment", "effective_start": "2026-08-20", "effective_end": "2026-08-10"}, "effective_end must be"),
])
def test_typed_resource_contract_rejects_invalid_combinations(client: TestClient, payload: dict[str, object], message: str) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Invalid resources {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"invalid-resource-project-{suffix}")
    response = command(client, ops, "CreatePlanningResource", {
        "project_id": project.json()["result"]["id"], "name": "Invalid resource", **payload,
    }, f"invalid-resource-{suffix}")
    assert response.status_code == 400, response.text
    assert message in response.text


def test_typed_resource_database_constraints_and_migration_are_owned(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    suffix = uuid4().hex[:8]
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Resource constraints {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"resource-constraint-project-{suffix}")
    created = command(client, ops, "CreatePlanningResource", {
        "project_id": project.json()["result"]["id"], "name": "Compatible default",
    }, f"resource-constraint-row-{suffix}")
    resource_id = created.json()["result"]["resources"][0]["id"]
    with SessionLocal() as db:
        row = db.get(PlanningResource, resource_id)
        assert row is not None
        assert (row.resource_type, str(row.capacity_value), row.capacity_unit) == ("human", "1.000", "fte")
        row.capacity_unit = "currency"
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

    sql = (Path(__file__).parents[1] / "migrations" / "009_planning_typed_resources.sql").read_text(encoding="utf-8")
    for contract in (
        "ck_planning_resources_resource_type",
        "ck_planning_resources_type_capacity_unit",
        "ck_planning_resources_canonical_pair",
        "ck_planning_resources_effective_order",
        "ix_planning_core_resources_org_project_type",
        "ix_planning_core_resources_org_canonical",
    ):
        assert contract in sql
