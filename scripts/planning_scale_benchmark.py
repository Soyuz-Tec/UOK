from __future__ import annotations

import argparse
import json
import os
import platform
import sys
import time
from datetime import datetime, timedelta, timezone
from math import ceil
from pathlib import Path
from statistics import mean
from typing import Any, Callable
from uuid import uuid4

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "modules" / "planning.core" / "backend"))

from uok.db import SessionLocal, engine
from uok.models import Membership, PlanningProject, PlanningTask, PlanningTaskDependency
from uok.security import Actor
from uok_planning_core.batch import cmd_batch_operations
from uok_planning_core.read_model import schedule_read_model
from uok_planning_core.scheduler import validate_schedule
from uok_planning_core.schedule_math import default_calendar

READ_BUDGET_MS, VALIDATION_BUDGET_MS, BATCH_BUDGET_MS = 500.0, 2_000.0, 2_000.0


def run_benchmarks(samples: int = 6) -> dict[str, Any]:
    if samples < 3:
        raise ValueError("samples must be at least 3")
    with SessionLocal() as db:
        membership = db.scalars(select(Membership).order_by(Membership.id)).first()
        if not membership:
            raise RuntimeError("A seeded organization membership is required for the scale benchmark")
        actor = Actor(
            user_id=membership.user_id,
            username=membership.user.username,
            organization_id=membership.organization_id,
            role=membership.role,
        )
        project, tasks = _persist_schedule(db, actor, task_count=500, dependency_count=800)
        db.flush()
        schedule_read_model(db, actor, project)
        read_samples = _measure(samples, lambda: schedule_read_model(db, actor, project))
        batch_samples = _measure(samples, lambda: _run_batch(db, actor, project, tasks))
        db.rollback()

    validation_tasks, validation_dependencies = _schedule_rows(
        "validation", actor.organization_id, str(uuid4()), 2_000, 3_000
    )
    validate_schedule(validation_tasks, validation_dependencies, default_calendar())
    validation_samples = _measure(
        samples,
        lambda: _validated(validation_tasks, validation_dependencies),
    )
    scenarios = {
        "schedule_read_500_tasks_800_dependencies": _result(read_samples, READ_BUDGET_MS),
        "validation_2000_tasks_3000_dependencies": _result(validation_samples, VALIDATION_BUDGET_MS),
        "batch_100_task_updates": _result(batch_samples, BATCH_BUDGET_MS),
    }
    return {
        "schema": "uok.planning_scale_benchmark.v1",
        "profile": _profile(),
        "samples_per_scenario": samples,
        "scenarios": scenarios,
        "ok": all(item["ok"] for item in scenarios.values()),
    }


def _persist_schedule(db, actor: Actor, task_count: int, dependency_count: int):
    project_id = str(uuid4())
    start = datetime(2027, 1, 4, tzinfo=timezone.utc)
    project = PlanningProject(
        id=project_id,
        organization_id=actor.organization_id,
        name=f"Scale benchmark {project_id}",
        status="active",
        start_at=start,
        end_at=start + timedelta(days=3650),
        timezone_name="UTC",
        revision=1,
        attrs_json="{}",
    )
    tasks, dependencies = _schedule_rows("read", actor.organization_id, project_id, task_count, dependency_count)
    db.add(project)
    db.add_all(tasks)
    db.flush()
    db.add_all(dependencies)
    return project, tasks


def _schedule_rows(prefix: str, organization_id: str, project_id: str, task_count: int, dependency_count: int):
    start = datetime(2027, 1, 4, tzinfo=timezone.utc)
    task_ids = [str(uuid4()) for _ in range(task_count)]
    tasks = [
        PlanningTask(
            id=task_id,
            organization_id=organization_id,
            project_id=project_id,
            title=f"{prefix.title()} task {index + 1}",
            task_type="task",
            status="planned",
            start_at=start,
            end_at=start,
            duration_days=1,
            progress=0,
            sort_order=index,
            version=1,
            attrs_json="{}",
        )
        for index, task_id in enumerate(task_ids)
    ]
    pairs = [(index, index + 1) for index in range(task_count - 1)]
    pairs.extend((index, index + 2) for index in range(dependency_count - len(pairs)))
    dependencies = [
        PlanningTaskDependency(
            id=str(uuid4()),
            organization_id=organization_id,
            project_id=project_id,
            predecessor_task_id=task_ids[source],
            successor_task_id=task_ids[target],
            dependency_type="start_to_start",
            lag_days=0,
        )
        for source, target in pairs
    ]
    return tasks, dependencies


def _run_batch(db, actor: Actor, project: PlanningProject, tasks: list[PlanningTask]) -> None:
    operations = [
        {"operation_id": f"scale-{index}", "kind": "update_task", "payload": {"task_id": task.id, "progress": (task.progress + 1) % 100, "cascade": False}}
        for index, task in enumerate(tasks[:100])
    ]
    cmd_batch_operations(
        db,
        actor,
        {"project_id": project.id, "reason": "Planning scale budget proof", "operations": operations},
        str(uuid4()),
    )


def _validated(tasks: list[PlanningTask], dependencies: list[PlanningTaskDependency]) -> None:
    violations = validate_schedule(tasks, dependencies, default_calendar())
    if violations:
        raise AssertionError(f"Scale fixture is invalid: {violations[:3]}")


def _measure(samples: int, operation: Callable[[], Any]) -> list[float]:
    values: list[float] = []
    for _ in range(samples):
        started = time.perf_counter()
        operation()
        values.append((time.perf_counter() - started) * 1_000)
    return values


def _result(samples: list[float], budget_ms: float) -> dict[str, Any]:
    ordered = sorted(samples)
    p95 = ordered[max(0, ceil(len(ordered) * 0.95) - 1)]
    return {
        "budget_ms": budget_ms,
        "p95_ms": round(p95, 2),
        "mean_ms": round(mean(samples), 2), "max_ms": round(max(samples), 2),
        "ok": p95 < budget_ms,
        "samples_ms": [round(value, 2) for value in samples],
    }


def _profile() -> dict[str, Any]:
    return {
        "database": engine.dialect.name, "python": platform.python_version(),
        "platform": platform.platform(), "machine": platform.machine(),
        "processor": platform.processor(), "logical_cpu_count": os.cpu_count(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure the approved UOK Planning scale budgets without persisting fixture data.")
    parser.add_argument("--samples", type=int, default=6)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = run_benchmarks(args.samples)
    rendered = json.dumps(result, indent=2)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
