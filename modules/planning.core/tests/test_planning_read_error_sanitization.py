from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth, command

INTERNAL_SENTINEL = r"internal parser detail C:\uok\private\tenant-record.json"


def test_read_models_do_not_expose_internal_integrity_exceptions(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ops, evidence = _analysis_evidence(client)

    from uok_planning_core._internal.analysis import risk_analysis, what_if
    from uok_planning_core._internal.scheduling import baselines

    def invalid_json(*_args: object, **_kwargs: object) -> dict[str, Any]:
        raise ValueError(INTERNAL_SENTINEL)

    with monkeypatch.context() as patch:
        patch.setattr(baselines, "loads", invalid_json)
        schedule = client.get(f"/api/planning/projects/{evidence['project_id']}/schedule", headers=ops)
        comparison = client.get(
            f"/api/planning/projects/{evidence['project_id']}/baselines/compare",
            params={"left_baseline_id": evidence["baseline_id"], "right_baseline_id": evidence["baseline_id"]},
            headers=ops,
        )
        detail = client.get(
            f"/api/planning/projects/{evidence['project_id']}/baselines/{evidence['baseline_id']}",
            headers=ops,
        )
        assert schedule.status_code == 200, schedule.text
        assert comparison.status_code == 200, comparison.text
        assert detail.status_code == 200, detail.text
        assert schedule.json()["baselines"][0]["integrity"] == {
            "status": "corrupt",
            "verified": False,
            "algorithm": "sha256",
            "missing_facts": [],
            "message": "Baseline snapshot JSON is invalid.",
        }
        assert comparison.json()["left"]["integrity"]["message"] == "Baseline snapshot JSON is invalid."
        assert detail.json()["integrity"]["message"] == "Baseline snapshot JSON is invalid."
        assert detail.json()["snapshot"] == {}
        assert INTERNAL_SENTINEL not in schedule.text
        assert INTERNAL_SENTINEL not in comparison.text
        assert INTERNAL_SENTINEL not in detail.text

    with monkeypatch.context() as patch:
        patch.setattr(what_if, "loads", invalid_json)
        snapshots = client.get(f"/api/planning/projects/{evidence['project_id']}/what-if-snapshots", headers=ops)
        assert snapshots.status_code == 200, snapshots.text
        assert snapshots.json()[0]["integrity"]["status"] == "corrupt"
        assert snapshots.json()[0]["integrity"]["message"] == "Snapshot JSON is invalid."
        assert INTERNAL_SENTINEL not in snapshots.text

    with monkeypatch.context() as patch:
        patch.setattr(what_if, "loads", lambda *_args, **_kwargs: {"schema_version": 1, "source": []})
        detail = client.get(
            f"/api/planning/projects/{evidence['project_id']}/what-if-snapshots/{evidence['snapshot_id']}",
            headers=ops,
        )
        assert detail.status_code == 400, detail.text
        assert detail.json() == {
            "detail": {
                "error": "Planning project was not found or its what-if snapshots are unavailable.",
            },
        }

    with monkeypatch.context() as patch:
        patch.setattr(risk_analysis, "loads", invalid_json)
        analyses = client.get(f"/api/planning/projects/{evidence['project_id']}/risk-analyses", headers=ops)
        assert analyses.status_code == 200, analyses.text
        assert analyses.json()[0]["integrity"]["status"] == "corrupt"
        assert analyses.json()[0]["integrity"]["message"] == "Analysis JSON is invalid."
        assert INTERNAL_SENTINEL not in analyses.text

    with monkeypatch.context() as patch:
        patch.setattr(risk_analysis, "loads", invalid_json)
        optimizations = client.get(f"/api/planning/projects/{evidence['project_id']}/optimizations", headers=ops)
        assert optimizations.status_code == 200, optimizations.text
        assert optimizations.json()[0]["integrity"]["status"] == "corrupt"
        assert optimizations.json()[0]["integrity"]["message"] == "Analysis JSON is invalid."
        assert INTERNAL_SENTINEL not in optimizations.text


@pytest.mark.parametrize(
    ("target", "path", "params", "public_error"),
    [
        ("schedule", "/api/planning/projects/{project_id}/schedule", None, "Planning project was not found or its schedule is unavailable."),
        ("baseline", "/api/planning/projects/{project_id}/baselines/compare", {"left_baseline_id": "left", "right_baseline_id": "right"}, "Planning project or baseline was not found or could not be compared."),
        ("what_if", "/api/planning/projects/{project_id}/what-if-snapshots", None, "Planning project was not found or its what-if snapshots are unavailable."),
        ("risk", "/api/planning/projects/{project_id}/risk-analyses", None, "Planning project was not found or its risk analyses are unavailable."),
        ("optimization", "/api/planning/projects/{project_id}/optimizations", None, "Planning project was not found or its optimizations are unavailable."),
        ("what_if_detail", "/api/planning/projects/{project_id}/what-if-snapshots/snapshot", None, "Planning project was not found or its what-if snapshots are unavailable."),
        ("risk_detail", "/api/planning/projects/{project_id}/risk-analyses/run", None, "Planning project was not found or its risk analyses are unavailable."),
        ("optimization_detail", "/api/planning/projects/{project_id}/optimizations/run", None, "Planning project was not found or its optimizations are unavailable."),
        ("recommendations", "/api/planning/projects/{project_id}/recommendations", None, "Planning project was not found or its recommendations are unavailable."),
        ("baseline_detail", "/api/planning/projects/{project_id}/baselines/baseline", None, "Planning project or baseline was not found or could not be read."),
    ],
)
def test_reported_read_boundaries_do_not_echo_unexpected_value_errors(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    target: str,
    path: str,
    params: dict[str, str] | None,
    public_error: str,
) -> None:
    ops, evidence = _analysis_evidence(client)

    from uok_planning_core._internal.analysis import analysis_api
    from uok_planning_core._internal.delivery import api

    def internal_failure(*_args: object, **_kwargs: object) -> Any:
        raise ValueError(INTERNAL_SENTINEL)

    targets: dict[str, tuple[object, str]] = {
        "schedule": (api, "read_locked_schedule_snapshot"),
        "baseline": (api, "compare_baselines"),
        "what_if": (analysis_api, "list_what_if_snapshots"),
        "risk": (analysis_api, "list_risk_analyses"),
        "optimization": (analysis_api, "list_optimizations"),
        "what_if_detail": (analysis_api, "what_if_or_error"),
        "risk_detail": (analysis_api, "risk_analysis_or_error"),
        "optimization_detail": (analysis_api, "optimization_or_error"),
        "recommendations": (analysis_api, "list_recommendations"),
        "baseline_detail": (api, "baseline_or_error"),
    }
    module, attribute = targets[target]
    monkeypatch.setattr(module, attribute, internal_failure)

    response = client.get(path.format(project_id=evidence["project_id"]), params=params, headers=ops)
    assert response.status_code == 400
    assert response.json() == {"detail": {"error": public_error}}
    assert INTERNAL_SENTINEL not in response.text


def _analysis_evidence(client: TestClient) -> tuple[dict[str, str], dict[str, str]]:
    suffix = uuid4().hex[:8]
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    for module in ("calendar.core", "planning.core"):
        assert client.post(f"/api/modules/{module}/install", headers=admin).status_code == 200

    project = command(client, ops, "CreatePlanningProject", {
        "name": f"Sanitized reads {suffix}", "start": "2031-05-01", "end": "2031-05-15",
    }, f"sanitized-read-project-{suffix}")
    assert project.status_code == 200, project.text
    project_id = str(project.json()["result"]["id"])
    task = command(client, ops, "CreatePlanningTask", {
        "project_id": project_id, "title": "Sanitized task",
        "start": "2031-05-01", "end": "2031-05-05",
    }, f"sanitized-read-task-{suffix}")
    assert task.status_code == 200, task.text
    task_id = str(task.json()["result"]["id"])
    baseline = command(client, ops, "CreatePlanningBaseline", {
        "project_id": project_id, "name": "Sanitized baseline",
    }, f"sanitized-read-baseline-{suffix}")
    assert baseline.status_code == 200, baseline.text
    baseline_id = str(baseline.json()["result"]["baselines"][0]["id"])
    snapshot = command(client, ops, "CreatePlanningWhatIfSnapshot", {
        "project_id": project_id, "name": "Sanitized snapshot",
        "task_changes": [{"task_id": task_id, "progress": 10}],
    }, f"sanitized-read-snapshot-{suffix}")
    assert snapshot.status_code == 200, snapshot.text
    snapshot_id = str(snapshot.json()["result"]["what_if_snapshot"]["id"])
    risk = command(client, ops, "RunPlanningRiskAnalysis", {
        "project_id": project_id, "snapshot_id": snapshot_id, "seed": 7, "iterations": 100,
        "task_risks": [{"task_id": task_id, "minimum_days": 3, "most_likely_days": 5, "maximum_days": 7}],
    }, f"sanitized-read-risk-{suffix}")
    assert risk.status_code == 200, risk.text
    optimization_response = command(client, ops, "RunPlanningOptimization", {
        "project_id": project_id, "snapshot_id": snapshot_id,
        "timeout_ms": 500, "max_candidates": 10,
    }, f"sanitized-read-optimization-{suffix}")
    assert optimization_response.status_code == 200, optimization_response.text
    return ops, {
        "project_id": project_id,
        "baseline_id": baseline_id,
        "snapshot_id": snapshot_id,
    }
