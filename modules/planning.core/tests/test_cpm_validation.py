from __future__ import annotations

from dataclasses import replace
from datetime import date
from pathlib import Path
import sys

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from planning_cpm_fixtures import Dependency, task
from uok_planning_core._internal.scheduling.cpm import calculate_cpm
from uok_planning_core._internal.scheduling.cpm_validation import validate_cpm_result
from uok_planning_core._internal.scheduling.schedule_math import default_calendar
from uok_planning_core._internal.scheduling.scheduler import validate_schedule

START = date(2026, 8, 3)


def test_independent_validator_accepts_known_parallel_merge() -> None:
    tasks = [task("start", 2), task("long", 4), task("short", 2), task("merge", 1)]
    dependencies = [
        Dependency("start", "long"),
        Dependency("start", "short"),
        Dependency("long", "merge"),
        Dependency("short", "merge"),
    ]
    result = calculate_cpm(tasks, dependencies, default_calendar(), START)

    assert validate_cpm_result(tasks, dependencies, default_calendar(), result) == []


def test_independent_validator_rejects_injected_dependency_and_duration_errors() -> None:
    tasks = [task("a", 3), task("b", 2)]
    dependencies = [Dependency("a", "b")]
    result = calculate_cpm(tasks, dependencies, default_calendar(), START)
    invalid_b = replace(result.task_metrics["b"], early_start=date(2026, 8, 4))
    tampered = replace(result, task_metrics={**result.task_metrics, "b": invalid_b})

    codes = {issue.code for issue in validate_cpm_result(tasks, dependencies, default_calendar(), tampered)}

    assert "cpm_duration_mismatch" in codes
    assert "cpm_early_dependency" in codes


def test_manual_task_conflict_is_preserved_and_reported() -> None:
    tasks = [
        task("predecessor", 3),
        task("manual", 2, start=date(2026, 8, 4), scheduling_mode="manual"),
    ]
    dependencies = [Dependency("predecessor", "manual")]
    result = calculate_cpm(tasks, dependencies, default_calendar(), START)

    issues = validate_cpm_result(tasks, dependencies, default_calendar(), result)

    assert result.task_metrics["manual"].early_start.isoformat() == "2026-08-04"
    assert any(issue.code == "cpm_early_dependency" for issue in issues)


def test_constraint_conflict_has_a_stable_validator_code() -> None:
    constrained = task(
        "bounded",
        3,
        constraint_type="finish_no_later_than",
        constraint_date=date(2026, 8, 4),
    )
    result = calculate_cpm([constrained], [], default_calendar(), START)

    issues = validate_cpm_result([constrained], [], default_calendar(), result)

    assert [issue.code for issue in issues] == ["cpm_task_constraint"]


def test_injected_non_working_date_is_rejected() -> None:
    scheduled = task("calendar", 2)
    result = calculate_cpm([scheduled], [], default_calendar(), START)
    invalid = replace(
        result.task_metrics["calendar"],
        early_start=date(2026, 8, 8),
        early_finish=date(2026, 8, 9),
    )
    tampered = replace(result, task_metrics={"calendar": invalid})

    codes = {issue.code for issue in validate_cpm_result([scheduled], [], default_calendar(), tampered)}

    assert "cpm_non_working_date" in codes
    assert "cpm_noncanonical_early" in codes


def test_summary_dependencies_are_rejected_by_domain_validation() -> None:
    tasks = [task("summary", 5, task_type="summary"), task("child", 2)]

    violations = validate_schedule(tasks, [Dependency("summary", "child")], default_calendar())

    assert "dependency cannot reference a summary task" in violations
