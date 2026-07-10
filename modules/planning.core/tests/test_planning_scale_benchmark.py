from __future__ import annotations

from starlette.testclient import TestClient

from scripts.planning_scale_benchmark import run_benchmarks


def test_approved_planning_scale_budgets_are_measured(client: TestClient) -> None:
    assert client is not None
    evidence = run_benchmarks(samples=3)

    assert evidence["schema"] == "uok.planning_scale_benchmark.v1"
    assert evidence["profile"]["database"] == "sqlite"
    assert evidence["samples_per_scenario"] == 3
    assert evidence["ok"], evidence
    assert set(evidence["scenarios"]) == {
        "schedule_read_500_tasks_800_dependencies",
        "validation_2000_tasks_3000_dependencies",
        "batch_100_task_updates",
    }
