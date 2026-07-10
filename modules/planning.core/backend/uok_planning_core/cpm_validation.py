from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .cpm import CpmDependencyLike, CpmResult, CpmTaskLike
from .schedule_math import CalendarSpec, end_for_start, shift_working, signed_working_distance, start_for_finish
from .task_constraints import is_auto_scheduled, task_constraint


@dataclass(frozen=True)
class CpmValidationIssue:
    code: str
    message: str
    object_ids: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {"code": self.code, "message": self.message, "object_ids": list(self.object_ids)}


def validate_cpm_result(
    tasks: list[CpmTaskLike],
    dependencies: list[CpmDependencyLike],
    calendar: CalendarSpec,
    result: CpmResult,
) -> list[CpmValidationIssue]:
    active = {task.id: task for task in tasks if task.task_type != "summary"}
    active_dependencies = [
        dep for dep in dependencies
        if dep.predecessor_task_id in active and dep.successor_task_id in active
    ]
    incoming = {task_id: [] for task_id in active}
    outgoing = {task_id: [] for task_id in active}
    for dep in active_dependencies:
        incoming[dep.successor_task_id].append(dep)
        outgoing[dep.predecessor_task_id].append(dep)
    issues: list[CpmValidationIssue] = []
    if set(result.task_metrics) != set(active):
        issues.append(_issue("cpm_metric_coverage", "CPM metrics do not cover exactly the schedulable tasks.", *sorted(active)))
        return issues

    for task_id, task in active.items():
        metric = result.task_metrics[task_id]
        duration = _duration(task)
        expected_early_finish = metric.early_start if duration == 0 else end_for_start(metric.early_start, duration, calendar)
        expected_late_finish = metric.late_start if duration == 0 else end_for_start(metric.late_start, duration, calendar)
        if metric.early_finish != expected_early_finish or metric.late_finish != expected_late_finish:
            issues.append(_issue("cpm_duration_mismatch", f"{task.title} CPM dates do not preserve its duration.", task_id))
        if not calendar.is_working_day(metric.early_start) or not calendar.is_working_day(metric.early_finish):
            issues.append(_issue("cpm_non_working_date", f"{task.title} CPM early dates are not working dates.", task_id))
        expected_float = signed_working_distance(metric.early_start, metric.late_start, calendar)
        if metric.total_slack_days != expected_float or metric.critical != (expected_float <= 0):
            issues.append(_issue("cpm_float_mismatch", f"{task.title} CPM float or critical flag is inconsistent.", task_id))
        if metric.free_float_days != _expected_free_float(task, metric.early_start, outgoing[task_id], result, calendar):
            issues.append(_issue("cpm_free_float_mismatch", f"{task.title} CPM free float is inconsistent.", task_id))
        issues.extend(_task_constraint_issues(task, metric.early_start, metric.early_finish))
        if not is_auto_scheduled(task) and (metric.early_start != task.start_at.date() or metric.early_finish != task.end_at.date()):
            issues.append(_issue("cpm_manual_task_moved", f"{task.title} manual dates were changed by CPM.", task_id))
        if is_auto_scheduled(task) and metric.early_start != _expected_early_start(task, incoming[task_id], result, calendar):
            issues.append(_issue("cpm_noncanonical_early", f"{task.title} CPM early start is not the earliest permitted date.", task_id))
        if metric.late_start != _expected_late_start(task, outgoing[task_id], result, calendar):
            issues.append(_issue("cpm_noncanonical_late", f"{task.title} CPM late start is not the latest permitted date.", task_id))

    for dep in dependencies:
        if dep.predecessor_task_id not in active or dep.successor_task_id not in active:
            continue
        predecessor = result.task_metrics[dep.predecessor_task_id]
        successor = result.task_metrics[dep.successor_task_id]
        if not _relation_holds(predecessor.early_start, predecessor.early_finish, successor.early_start, successor.early_finish, dep, calendar):
            issues.append(_issue("cpm_early_dependency", "CPM early dates violate a dependency.", dep.predecessor_task_id, dep.successor_task_id))
        if not _relation_holds(predecessor.late_start, predecessor.late_finish, successor.late_start, successor.late_finish, dep, calendar):
            issues.append(_issue("cpm_late_dependency", "CPM late dates violate a dependency.", dep.predecessor_task_id, dep.successor_task_id))

    calculated_finish = max((metric.early_finish for metric in result.task_metrics.values()), default=result.project_start)
    if result.calculated_finish != calculated_finish:
        issues.append(_issue("cpm_project_finish", "Calculated project finish does not match task early finishes."))
    expected_variance = signed_working_distance(result.target_finish, result.calculated_finish, calendar)
    if result.target_variance_days != expected_variance:
        issues.append(_issue("cpm_target_variance", "Target variance does not match calculated finish."))
    return _deduplicate(issues)


def _task_constraint_issues(task: CpmTaskLike, start: date, finish: date) -> list[CpmValidationIssue]:
    constraint_type, constraint_date = task_constraint(task)
    if not constraint_type or not constraint_date:
        return []
    valid = {
        "must_start_on": start == constraint_date,
        "must_finish_on": finish == constraint_date,
        "start_no_earlier_than": start >= constraint_date,
        "start_no_later_than": start <= constraint_date,
        "finish_no_earlier_than": finish >= constraint_date,
        "finish_no_later_than": finish <= constraint_date,
    }[constraint_type]
    return [] if valid else [_issue("cpm_task_constraint", f"{task.title} CPM dates violate {constraint_type}.", task.id)]


def _expected_early_start(
    task: CpmTaskLike,
    incoming: list[CpmDependencyLike],
    result: CpmResult,
    calendar: CalendarSpec,
) -> date:
    constraint_type, constraint_date = task_constraint(task)
    start = result.project_start
    if constraint_type == "must_start_on":
        start = constraint_date or start
    elif constraint_type == "must_finish_on" and constraint_date:
        start = start_for_finish(constraint_date, _duration(task), calendar)
    elif constraint_type == "start_no_earlier_than" and constraint_date:
        start = max(start, constraint_date)
    elif constraint_type == "finish_no_earlier_than" and constraint_date:
        start = max(start, start_for_finish(constraint_date, _duration(task), calendar))
    for dep in incoming:
        predecessor = result.task_metrics[dep.predecessor_task_id]
        start = max(start, _successor_required_start(predecessor.early_start, predecessor.early_finish, task, dep, calendar))
    return start


def _expected_late_start(
    task: CpmTaskLike,
    outgoing: list[CpmDependencyLike],
    result: CpmResult,
    calendar: CalendarSpec,
) -> date:
    anchor = min(result.target_finish, result.calculated_finish)
    candidates = [start_for_finish(anchor, _duration(task), calendar)]
    for dep in outgoing:
        successor = result.task_metrics[dep.successor_task_id]
        candidates.append(_predecessor_allowed_start(task, successor.late_start, successor.late_finish, dep, calendar))
    return min(candidates)


def _expected_free_float(
    task: CpmTaskLike,
    early_start: date,
    outgoing: list[CpmDependencyLike],
    result: CpmResult,
    calendar: CalendarSpec,
) -> int:
    total_float = signed_working_distance(early_start, result.task_metrics[task.id].late_start, calendar)
    if not outgoing:
        return total_float
    relation_float = min(
        signed_working_distance(
            early_start,
            _predecessor_allowed_start(
                task,
                result.task_metrics[dep.successor_task_id].early_start,
                result.task_metrics[dep.successor_task_id].early_finish,
                dep,
                calendar,
            ),
            calendar,
        )
        for dep in outgoing
    )
    return min(total_float, relation_float)


def _successor_required_start(
    predecessor_start: date,
    predecessor_finish: date,
    successor: CpmTaskLike,
    dep: CpmDependencyLike,
    calendar: CalendarSpec,
) -> date:
    if dep.dependency_type == "finish_to_start":
        return shift_working(predecessor_finish, dep.lag_days + 1, calendar)
    if dep.dependency_type == "start_to_start":
        return shift_working(predecessor_start, dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        return start_for_finish(shift_working(predecessor_finish, dep.lag_days, calendar), _duration(successor), calendar)
    return start_for_finish(shift_working(predecessor_start, dep.lag_days, calendar), _duration(successor), calendar)


def _predecessor_allowed_start(
    predecessor: CpmTaskLike,
    successor_start: date,
    successor_finish: date,
    dep: CpmDependencyLike,
    calendar: CalendarSpec,
) -> date:
    if dep.dependency_type == "finish_to_start":
        finish = shift_working(successor_start, -(dep.lag_days + 1), calendar)
        return start_for_finish(finish, _duration(predecessor), calendar)
    if dep.dependency_type == "start_to_start":
        return shift_working(successor_start, -dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        finish = shift_working(successor_finish, -dep.lag_days, calendar)
        return start_for_finish(finish, _duration(predecessor), calendar)
    return shift_working(successor_finish, -dep.lag_days, calendar)


def _relation_holds(
    predecessor_start: date,
    predecessor_finish: date,
    successor_start: date,
    successor_finish: date,
    dep: CpmDependencyLike,
    calendar: CalendarSpec,
) -> bool:
    if dep.dependency_type == "finish_to_start":
        return successor_start >= shift_working(predecessor_finish, dep.lag_days + 1, calendar)
    if dep.dependency_type == "start_to_start":
        return successor_start >= shift_working(predecessor_start, dep.lag_days, calendar)
    if dep.dependency_type == "finish_to_finish":
        return successor_finish >= shift_working(predecessor_finish, dep.lag_days, calendar)
    if dep.dependency_type == "start_to_finish":
        return successor_finish >= shift_working(predecessor_start, dep.lag_days, calendar)
    return False


def _duration(task: CpmTaskLike) -> int:
    return 0 if task.task_type == "milestone" else max(1, int(task.duration_days))


def _issue(code: str, message: str, *object_ids: str) -> CpmValidationIssue:
    return CpmValidationIssue(code, message, tuple(object_ids))


def _deduplicate(issues: list[CpmValidationIssue]) -> list[CpmValidationIssue]:
    found: dict[tuple[str, tuple[str, ...]], CpmValidationIssue] = {}
    for issue in issues:
        found[(issue.code, issue.object_ids)] = issue
    return list(found.values())
