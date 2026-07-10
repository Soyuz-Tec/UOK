from __future__ import annotations

from datetime import date
from pathlib import Path
import sys

import pytest

BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from planning_cpm_fixtures import Dependency, task
from uok_planning_core.cpm import CpmCycleError, calculate_cpm
from uok_planning_core.schedule_math import CalendarSpec, default_calendar

START = date(2026, 8, 3)


def test_chain_is_logic_driven_and_independent_of_input_order() -> None:
    tasks = [task("build", 2, start=date(2026, 8, 12)), task("design", 3, start=date(2026, 8, 10))]
    dependencies = [Dependency("design", "build")]

    first = calculate_cpm(tasks, dependencies, default_calendar(), START)
    reordered = calculate_cpm(list(reversed(tasks)), dependencies, default_calendar(), START)

    assert _dates(first, "design") == ("2026-08-03", "2026-08-05", "2026-08-03", "2026-08-05")
    assert _dates(first, "build") == ("2026-08-06", "2026-08-07", "2026-08-06", "2026-08-07")
    assert first.task_metrics == reordered.task_metrics
    assert all(metric.critical for metric in first.task_metrics.values())


def test_parallel_merge_identifies_longest_path_and_free_float() -> None:
    tasks = [task("start", 2), task("long", 4), task("short", 2), task("merge", 1)]
    dependencies = [
        Dependency("start", "long"),
        Dependency("start", "short"),
        Dependency("long", "merge"),
        Dependency("short", "merge"),
    ]

    result = calculate_cpm(tasks, dependencies, default_calendar(), START)

    assert _metric_rows(result) == {
        "start": ("2026-08-03", "2026-08-04", "2026-08-03", "2026-08-04", 0, 0),
        "long": ("2026-08-05", "2026-08-10", "2026-08-05", "2026-08-10", 0, 0),
        "short": ("2026-08-05", "2026-08-06", "2026-08-07", "2026-08-10", 2, 2),
        "merge": ("2026-08-11", "2026-08-11", "2026-08-11", "2026-08-11", 0, 0),
    }
    assert not result.task_metrics["short"].critical
    assert {task_id for task_id, row in result.task_metrics.items() if row.critical} == {"start", "long", "merge"}


@pytest.mark.parametrize(
    ("dependency_type", "lag", "expected_start", "expected_finish"),
    [
        ("finish_to_start", 1, "2026-08-07", "2026-08-10"),
        ("finish_to_start", -1, "2026-08-05", "2026-08-06"),
        ("start_to_start", 2, "2026-08-05", "2026-08-06"),
        ("finish_to_finish", 1, "2026-08-05", "2026-08-06"),
        ("start_to_finish", 1, "2026-08-03", "2026-08-04"),
    ],
)
def test_dependency_types_and_lag_lead_are_calendar_aware(
    dependency_type: str,
    lag: int,
    expected_start: str,
    expected_finish: str,
) -> None:
    result = calculate_cpm(
        [task("predecessor", 3), task("successor", 2)],
        [Dependency("predecessor", "successor", dependency_type, lag)],
        default_calendar(),
        START,
    )

    assert _dates(result, "successor")[:2] == (expected_start, expected_finish)


def test_holiday_milestone_and_summary_rules_are_explicit() -> None:
    calendar = CalendarSpec(frozenset({1, 2, 3, 4, 5}), frozenset({date(2026, 8, 7)}))
    tasks = [
        task("summary", 10, task_type="summary", calendar=calendar),
        task("work", 5, calendar=calendar),
        task("gate", 0, task_type="milestone", calendar=calendar),
    ]
    result = calculate_cpm(tasks, [Dependency("work", "gate", lag_days=1)], calendar, START)

    assert set(result.task_metrics) == {"work", "gate"}
    assert _dates(result, "work")[:2] == ("2026-08-03", "2026-08-10")
    assert _dates(result, "gate")[:2] == ("2026-08-12", "2026-08-12")


def test_disconnected_short_path_has_float_against_calculated_finish() -> None:
    result = calculate_cpm([task("long", 5), task("short", 2)], [], default_calendar(), START)

    assert result.task_metrics["long"].total_slack_days == 0
    assert result.task_metrics["short"].total_slack_days == 3
    assert result.task_metrics["short"].free_float_days == 3


def test_hard_date_constraints_shape_the_earliest_schedule() -> None:
    tasks = [
        task("not-earlier", 2, constraint_type="start_no_earlier_than", constraint_date=date(2026, 8, 6)),
        task("fixed-finish", 2, constraint_type="must_finish_on", constraint_date=date(2026, 8, 10)),
    ]
    result = calculate_cpm(tasks, [], default_calendar(), START)

    assert _dates(result, "not-earlier")[:2] == ("2026-08-06", "2026-08-07")
    assert _dates(result, "fixed-finish")[:2] == ("2026-08-07", "2026-08-10")


def test_early_target_produces_negative_float_without_moving_commitment() -> None:
    result = calculate_cpm([task("delivery", 5)], [], default_calendar(), START, date(2026, 8, 5))
    metric = result.task_metrics["delivery"]

    assert result.calculated_finish.isoformat() == "2026-08-07"
    assert result.target_finish.isoformat() == "2026-08-05"
    assert result.target_variance_days == 2
    assert metric.total_slack_days == -2
    assert metric.critical


def test_non_working_target_is_preserved_while_late_math_uses_prior_working_anchor() -> None:
    target = date(2026, 8, 8)  # Saturday
    result = calculate_cpm([task("delivery", 5)], [], default_calendar(), START, target)
    metric = result.task_metrics["delivery"]

    assert result.engine_version == "uok-cpm-2"
    assert result.target_finish == target
    assert result.calculated_finish.isoformat() == "2026-08-07"
    assert result.target_variance_days == 0
    assert metric.late_finish.isoformat() == "2026-08-07"
    assert metric.total_slack_days == 0


def test_cycle_is_rejected_before_metrics_are_published() -> None:
    with pytest.raises(CpmCycleError, match="dependency cycle"):
        calculate_cpm(
            [task("a", 1), task("b", 1)],
            [Dependency("a", "b"), Dependency("b", "a")],
            default_calendar(),
            START,
        )


def _dates(result, task_id: str) -> tuple[str, str, str, str]:
    metric = result.task_metrics[task_id]
    return tuple(value.isoformat() for value in (metric.early_start, metric.early_finish, metric.late_start, metric.late_finish))


def _metric_rows(result) -> dict[str, tuple[str, str, str, str, int, int]]:
    return {
        task_id: (*_dates(result, task_id), metric.total_slack_days, metric.free_float_days)
        for task_id, metric in result.task_metrics.items()
    }
