from __future__ import annotations

from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok_planning_core._internal.persistence.models import PlanningAnalysisRun
from uok_planning_core._internal.analysis.risk_engine import run_risk_engine, validate_risk_result


def test_fixed_seed_risk_engine_is_exactly_reproducible(client: TestClient) -> None:
    _, ops, _, project_id, task_ids, snapshot_id, suffix = _setup(client)
    snapshot = client.get(f"/api/planning/projects/{project_id}/what-if-snapshots/{snapshot_id}", headers=ops).json()["snapshot"]
    inputs = _risk_payload(snapshot_id, task_ids, seed=42, iterations=500)

    first_inputs, first_limits, first_result = run_risk_engine(snapshot, inputs)
    second_inputs, second_limits, second_result = run_risk_engine(snapshot, inputs)

    assert first_inputs == second_inputs
    assert first_limits == second_limits
    assert first_result == second_result
    assert first_result["sample_count"] == 500
    assert first_result["confidence"] == {"method": "deterministic_empirical_percentiles", "iterations": 500}
    assert first_result["assumptions"]["correlation_method"] == "bounded_uniform_rank_blend"
    assert validate_risk_result(first_inputs, first_result) == []
    assert suffix


def test_risk_run_persists_seed_inputs_percentiles_and_integrity(client: TestClient) -> None:
    _, ops, viewer, project_id, task_ids, snapshot_id, suffix = _setup(client)
    payload = _risk_payload(snapshot_id, task_ids, seed=8675309, iterations=600)
    before = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops)
    response = client.post(
        f"/api/planning/projects/{project_id}/risk-analyses",
        headers={**ops, "If-Match": before.headers["ETag"], "Idempotency-Key": f"risk-run-{suffix}"},
        json=payload,
    )

    assert response.status_code == 200, response.text
    metadata = response.json()["risk_analysis"]
    assert metadata["engine"] == {"name": "uok-monte-carlo-risk", "version": "2"}
    assert metadata["seed"] == 8675309
    assert metadata["status"] == "completed"
    assert metadata["integrity"]["verified"] is True
    detail = client.get(f"/api/planning/projects/{project_id}/risk-analyses/{metadata['id']}", headers=viewer).json()
    assert detail["inputs"]["snapshot_id"] == snapshot_id
    assert len(detail["inputs"]["snapshot_checksum"]) == 64
    assert detail["inputs"]["correlations"] == [{"coefficient": 0.6, "group": "delivery"}]
    assert detail["result"]["independent_validation"] == {"ok": True, "violations": []}
    assert list(detail["result"]["finish_percentiles"]) == ["p50", "p80", "p90", "p95"]
    assert 0 <= detail["result"]["probability_on_or_before_target"] <= 1
    assert detail["limits"]["requested_sample_task_product"] == 1200

    after = client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).json()
    assert [(row["id"], row["start"], row["end"], row["version"]) for row in after["tasks"]] == [
        (row["id"], row["start"], row["end"], row["version"]) for row in before.json()["tasks"]
    ]
    with SessionLocal() as db:
        row = db.get(PlanningAnalysisRun, metadata["id"])
        assert row is not None
        row.status = "timeout"
        with pytest.raises(ValueError, match="immutable and append-only"):
            db.commit()
        db.rollback()


def test_risk_run_enforces_analysis_permission_and_distribution_contract(client: TestClient) -> None:
    _, ops, viewer, project_id, task_ids, snapshot_id, suffix = _setup(client)
    payload = {"project_id": project_id, **_risk_payload(snapshot_id, task_ids, seed=7, iterations=100)}
    denied = command(client, viewer, "RunPlanningRiskAnalysis", payload, f"risk-denied-{suffix}")
    assert denied.status_code == 403
    assert "planning.analyze" in denied.text

    invalid = client.post(
        f"/api/planning/projects/{project_id}/risk-analyses",
        headers={**ops, "If-Match": client.get(f"/api/planning/projects/{project_id}/schedule", headers=ops).headers["ETag"], "Idempotency-Key": f"risk-invalid-{suffix}"},
        json={
            **_risk_payload(snapshot_id, task_ids, seed=7, iterations=100),
            "task_risks": [{"task_id": task_ids[0], "minimum_days": 5, "most_likely_days": 4, "maximum_days": 3}],
        },
    )
    assert invalid.status_code == 422
    assert "minimum <= most_likely <= maximum" in invalid.text


def _setup(client: TestClient) -> tuple[dict[str, str], dict[str, str], dict[str, str], str, list[str], str, str]:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200
    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Risk {suffix}", "start": "2026-08-03", "end": "2026-08-31",
    }, f"risk-project-{suffix}")
    project_id = project.json()["result"]["id"]
    task_ids = []
    for index, dates in enumerate((("2026-08-03", "2026-08-05"), ("2026-08-06", "2026-08-10")), start=1):
        task = command(client, ops, "CreatePlanningTask", {
            "project_id": project_id, "title": f"Risk task {index}", "start": dates[0], "end": dates[1],
        }, f"risk-task-{suffix}-{index}")
        task_ids.append(task.json()["result"]["id"])
    linked = command(client, ops, "LinkPlanningTasks", {
        "project_id": project_id, "predecessor_task_id": task_ids[0], "successor_task_id": task_ids[1],
    }, f"risk-link-{suffix}")
    assert linked.status_code == 200, linked.text
    snapshot = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id, "name": "Risk source", "task_changes": [{"task_id": task_ids[0], "progress": 5}],
    }, f"risk-snapshot-{suffix}")
    snapshot_id = snapshot.json()["result"]["what_if_snapshot"]["id"]
    return admin, ops, viewer, project_id, task_ids, snapshot_id, suffix


def _risk_payload(snapshot_id: str, task_ids: list[str], *, seed: int, iterations: int) -> dict:
    return {
        "snapshot_id": snapshot_id,
        "seed": seed,
        "iterations": iterations,
        "task_risks": [
            {"task_id": task_ids[0], "distribution": "triangular", "minimum_days": 2, "most_likely_days": 3, "maximum_days": 6, "correlation_group": "delivery"},
            {"task_id": task_ids[1], "distribution": "triangular", "minimum_days": 3, "most_likely_days": 4, "maximum_days": 8, "correlation_group": "delivery"},
        ],
        "correlations": [{"group": "delivery", "coefficient": 0.6}],
    }
