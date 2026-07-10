from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from typing import Any, Protocol

from .schedule_graph import dependency_order
from .schedule_math import (
    CalendarSpec,
    end_for_start,
    next_working_day,
    previous_working_day,
    shift_working,
    signed_working_distance,
    start_for_finish,
)
from .task_constraints import is_auto_scheduled, task_constraint

CPM_ENGINE_VERSION = "uok-cpm-1"


class CpmCycleError(ValueError):
    pass


class CpmTaskLike(Protocol):
    id: str
    title: str
    task_type: str
    duration_days: int
    start_at: Any
    end_at: Any
    attrs_json: str


class CpmDependencyLike(Protocol):
    predecessor_task_id: str
    successor_task_id: str
    dependency_type: str
    lag_days: int


@dataclass(frozen=True)
class CpmTaskMetric:
    early_start: date
    early_finish: date
    late_start: date
    late_finish: date
    total_slack_days: int
    free_float_days: int
    critical: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "early_start": self.early_start,
            "early_finish": self.early_finish,
            "late_start": self.late_start,
            "late_finish": self.late_finish,
            "total_slack_days": self.total_slack_days,
            "free_float_days": self.free_float_days,
            "critical": self.critical,
        }


@dataclass(frozen=True)
class CpmResult:
    project_start: date
    calculated_finish: date
    target_finish: date
    target_variance_days: int
    task_metrics: dict[str, CpmTaskMetric]
    engine_version: str = CPM_ENGINE_VERSION


def calculate_cpm(
    tasks: list[CpmTaskLike],
    dependencies: list[CpmDependencyLike],
    calendar: CalendarSpec,
    project_start: date,
    target_finish: date | None = None,
) -> CpmResult:
    active = [task for task in tasks if task.task_type != "summary"]
    by_id = {task.id: task for task in active}
    active_dependencies = [
        dep for dep in dependencies
        if dep.predecessor_task_id in by_id and dep.successor_task_id in by_id
    ]
    order = dependency_order(by_id, active_dependencies)
    if order is None:
        raise CpmCycleError("schedule contains a dependency cycle")

    normalized_start = next_working_day(project_start, calendar)
    if not active:
        target = previous_working_day(target_finish or normalized_start, calendar)
        return CpmResult(normalized_start, normalized_start, target, signed_working_distance(target, normalized_start, calendar), {})

    incoming, outgoing = _dependency_indexes(active_dependencies)
    early: dict[str, tuple[date, date]] = {}
    for task_id in order:
        task = by_id[task_id]
        start = _initial_start(task, normalized_start, calendar)
        if is_auto_scheduled(task):
            for dep in incoming[task_id]:
                predecessor = by_id[dep.predecessor_task_id]
                start = max(start, _successor_start(early[predecessor.id], task, dep, calendar))
        early[task_id] = (start, _finish(task, start, calendar))

    calculated_finish = max(finish for _, finish in early.values())
    target = previous_working_day(target_finish or calculated_finish, calendar)
    late_anchor = min(target, calculated_finish)
    late: dict[str, tuple[date, date]] = {}
    for task_id in reversed(order):
        task = by_id[task_id]
        candidates = [start_for_finish(late_anchor, _duration(task), calendar), *[
            _predecessor_latest_start(task, dep, late[dep.successor_task_id], calendar)
            for dep in outgoing[task_id]
        ]]
        start = min(candidates)
        late[task_id] = (start, _finish(task, start, calendar))

    metrics: dict[str, CpmTaskMetric] = {}
    for task_id in order:
        task = by_id[task_id]
        early_start, early_finish = early[task_id]
        late_start, late_finish = late[task_id]
        total_float = signed_working_distance(early_start, late_start, calendar)
        relation_float = _free_float(task, early[task_id], outgoing[task_id], early, calendar)
        free_float = min(total_float, relation_float) if relation_float is not None else total_float
        metrics[task_id] = CpmTaskMetric(
            early_start,
            early_finish,
            late_start,
            late_finish,
            total_float,
            free_float,
            total_float <= 0,
        )
    return CpmResult(
        normalized_start,
        calculated_finish,
        target,
        signed_working_distance(target, calculated_finish, calendar),
        metrics,
    )


def _dependency_indexes(dependencies: list[CpmDependencyLike]):
    incoming: dict[str, list[CpmDependencyLike]] = defaultdict(list)
    outgoing: dict[str, list[CpmDependencyLike]] = defaultdict(list)
    for dep in dependencies:
        incoming[dep.successor_task_id].append(dep)
        outgoing[dep.predecessor_task_id].append(dep)
    return incoming, outgoing


def _duration(task: CpmTaskLike) -> int:
    return 0 if task.task_type == "milestone" else max(1, int(task.duration_days))


def _finish(task: CpmTaskLike, start: date, calendar: CalendarSpec) -> date:
    return start if task.task_type == "milestone" else end_for_start(start, _duration(task), calendar)


def _initial_start(task: CpmTaskLike, project_start: date, calendar: CalendarSpec) -> date:
    if not is_auto_scheduled(task):
        return task.start_at.date()
    constraint_type, constraint_date = task_constraint(task)
    if not constraint_type or not constraint_date:
        return project_start
    if constraint_type == "must_start_on":
        return constraint_date
    if constraint_type == "must_finish_on":
        return start_for_finish(constraint_date, _duration(task), calendar)
    if constraint_type == "start_no_earlier_than":
        return max(project_start, constraint_date)
    if constraint_type == "finish_no_earlier_than":
        return max(project_start, start_for_finish(constraint_date, _duration(task), calendar))
    return project_start


def _successor_start(
    predecessor_dates: tuple[date, date],
    successor: CpmTaskLike,
    dep: CpmDependencyLike,
    calendar: CalendarSpec,
) -> date:
    predecessor_start, predecessor_finish = predecessor_dates
    if dep.dependency_type == "finish_to_start":
        return shift_working(predecessor_finish, dep.lag_days + 1, calendar)
    if dep.dependency_type == "start_to_start":
        return shift_working(predecessor_start, dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        return start_for_finish(shift_working(predecessor_finish, dep.lag_days, calendar), _duration(successor), calendar)
    return start_for_finish(shift_working(predecessor_start, dep.lag_days, calendar), _duration(successor), calendar)


def _predecessor_latest_start(
    predecessor: CpmTaskLike,
    dep: CpmDependencyLike,
    successor_dates: tuple[date, date],
    calendar: CalendarSpec,
) -> date:
    successor_start, successor_finish = successor_dates
    if dep.dependency_type == "finish_to_start":
        finish = shift_working(successor_start, -(dep.lag_days + 1), calendar)
        return start_for_finish(finish, _duration(predecessor), calendar)
    if dep.dependency_type == "start_to_start":
        return shift_working(successor_start, -dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        finish = shift_working(successor_finish, -dep.lag_days, calendar)
        return start_for_finish(finish, _duration(predecessor), calendar)
    return shift_working(successor_finish, -dep.lag_days, calendar)


def _free_float(
    task: CpmTaskLike,
    task_dates: tuple[date, date],
    successors: list[CpmDependencyLike],
    early: dict[str, tuple[date, date]],
    calendar: CalendarSpec,
) -> int | None:
    candidates = [
        signed_working_distance(
            task_dates[0],
            _predecessor_latest_start(task, dep, early[dep.successor_task_id], calendar),
            calendar,
        )
        for dep in successors
    ]
    return min(candidates) if candidates else None
