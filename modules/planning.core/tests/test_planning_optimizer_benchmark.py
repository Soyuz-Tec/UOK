from __future__ import annotations

from datetime import date
from time import perf_counter

from uok_planning_core.optimizer_engine import run_optimizer
from uok_planning_core.schedule_math import default_calendar, end_for_start, shift_working


def test_fifty_task_chain_optimizer_benchmark_stays_within_bound() -> None:
    snapshot = _chain_snapshot(50)

    started = perf_counter()
    _, limits, result = run_optimizer(snapshot, {
        "objective": "minimize_project_finish",
        "timeout_ms": 2000,
        "max_candidates": 50,
    })
    elapsed_ms = round((perf_counter() - started) * 1000, 3)

    assert result["status"] == "completed"
    assert result["independent_validation"]["ok"] is True
    assert limits["evaluated_candidates"] == 50
    assert limits["returned_recommendations"] == 5
    assert elapsed_ms < 5000


def _chain_snapshot(count: int) -> dict:
    calendar = default_calendar()
    tasks = []
    preview = []
    dependencies = []
    start = date(2026, 8, 3)
    for index in range(count):
        task_id = f"task-{index + 1}"
        end = end_for_start(start, 2, calendar)
        tasks.append({
            "id": task_id, "project_id": "project-1", "parent_task_id": None,
            "title": f"Chain task {index + 1}", "task_type": "task", "status": "planned",
            "start": start.isoformat(), "end": end.isoformat(), "duration_days": 2,
            "progress": 0, "sort_order": index + 1, "version": 1,
            "scheduling_mode": "auto", "critical": True, "attributes": {},
        })
        preview.append({"id": task_id, "start": start.isoformat(), "end": end.isoformat(), "duration_days": 2, "progress": 0})
        if index:
            dependencies.append({
                "id": f"dep-{index}", "predecessor_task_id": f"task-{index}",
                "successor_task_id": task_id, "dependency_type": "finish_to_start", "lag_days": 0,
            })
        start = shift_working(end, 1, calendar)
    return {
        "approved": {
            "project": {"id": "project-1", "start": "2026-08-03", "target_finish": "2027-12-31"},
            "calculation": {"engine_version": "uok-cpm-2"},
            "tasks": tasks,
            "dependencies": dependencies,
            "calendar": {"working_days": [1, 2, 3, 4, 5], "holidays": [], "ignored_periods": []},
        },
        "preview": {"tasks": preview},
    }
