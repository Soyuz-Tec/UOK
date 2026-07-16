from __future__ import annotations

from starlette.testclient import TestClient

from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path


BENCHMARK_PATH = Path(__file__).resolve().parents[1] / "verify" / "runtime" / "planning_scale_benchmark.py"
SPEC = spec_from_file_location("uok_planning_scale_benchmark", BENCHMARK_PATH)
assert SPEC is not None and SPEC.loader is not None
BENCHMARK_MODULE = module_from_spec(SPEC)
SPEC.loader.exec_module(BENCHMARK_MODULE)
run_benchmarks = BENCHMARK_MODULE.run_benchmarks


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
