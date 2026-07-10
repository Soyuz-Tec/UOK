from __future__ import annotations

from datetime import date, timedelta
from math import ceil, sqrt
from random import Random
from typing import Any

from .calendar_payload import calendar_holidays, calendar_ignored_dates
from .cpm import calculate_cpm
from .models import PlanningTask, PlanningTaskDependency
from .schedule_math import CalendarSpec, at_utc, working_duration
from uok.util import dumps

RISK_ENGINE_NAME = "uok-monte-carlo-risk"
RISK_ENGINE_VERSION = "1"
MIN_ITERATIONS = 100
MAX_ITERATIONS = 5000
MAX_RISK_TASKS = 200
MAX_SAMPLE_TASK_PRODUCT = 250_000


def run_risk_engine(snapshot: dict[str, Any], raw_inputs: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    inputs = risk_inputs(snapshot, raw_inputs)
    limits = {
        "min_iterations": MIN_ITERATIONS,
        "max_iterations": MAX_ITERATIONS,
        "max_risk_tasks": MAX_RISK_TASKS,
        "max_sample_task_product": MAX_SAMPLE_TASK_PRODUCT,
        "requested_sample_task_product": inputs["iterations"] * len(inputs["task_risks"]),
    }
    templates, dependencies, calendar, project_start, target_finish = _snapshot_schedule(snapshot)
    risk_by_task = {row["task_id"]: row for row in inputs["task_risks"]}
    correlations = {row["group"]: row["coefficient"] for row in inputs["correlations"]}
    rng = Random(inputs["seed"])
    finishes: list[date] = []
    durations: list[int] = []
    for _ in range(inputs["iterations"]):
        group_uniforms = {group: rng.random() for group in sorted(correlations)}
        sampled = {
            task_id: _sample_duration(spec, rng, group_uniforms, correlations)
            for task_id, spec in sorted(risk_by_task.items())
        }
        tasks = [_task_with_duration(row, sampled.get(str(row["id"])), calendar) for row in templates]
        analysis = calculate_cpm(tasks, dependencies, calendar, project_start, target_finish)
        finishes.append(analysis.calculated_finish)
        durations.append(working_duration(project_start, analysis.calculated_finish, calendar))
    result = _risk_result(finishes, durations, target_finish, inputs)
    return inputs, limits, result


def risk_inputs(snapshot: dict[str, Any], raw: dict[str, Any]) -> dict[str, Any]:
    task_ids = {str(task["id"]) for task in snapshot.get("approved", {}).get("tasks", [])}
    seed = _bounded_int(raw.get("seed"), "seed", 0, 9_223_372_036_854_775_807)
    iterations = _bounded_int(raw.get("iterations", 1000), "iterations", MIN_ITERATIONS, MAX_ITERATIONS)
    risks = raw.get("task_risks")
    if not isinstance(risks, list) or not 1 <= len(risks) <= MAX_RISK_TASKS:
        raise ValueError(f"task_risks must contain between 1 and {MAX_RISK_TASKS} rows")
    normalized: list[dict[str, Any]] = []
    found: set[str] = set()
    for row in risks:
        if not isinstance(row, dict):
            raise ValueError("each task risk must be an object")
        task_id = str(row.get("task_id") or "")
        if task_id not in task_ids or task_id in found:
            raise ValueError("task_risks must reference unique snapshot task IDs")
        minimum = _bounded_int(row.get("minimum_days"), "minimum_days", 1, 3650)
        mode = _bounded_int(row.get("most_likely_days"), "most_likely_days", minimum, 3650)
        maximum = _bounded_int(row.get("maximum_days"), "maximum_days", mode, 3650)
        group = str(row.get("correlation_group") or "").strip() or None
        normalized.append({
            "task_id": task_id,
            "distribution": "triangular",
            "minimum_days": minimum,
            "most_likely_days": mode,
            "maximum_days": maximum,
            "correlation_group": group,
        })
        found.add(task_id)
    if iterations * len(normalized) > MAX_SAMPLE_TASK_PRODUCT:
        raise ValueError(f"iterations multiplied by risk tasks must not exceed {MAX_SAMPLE_TASK_PRODUCT}")
    correlations = _correlations(raw.get("correlations", []))
    groups = {row["correlation_group"] for row in normalized if row["correlation_group"]}
    if groups - {row["group"] for row in correlations}:
        raise ValueError("every task correlation_group must have one correlation definition")
    return {
        "seed": seed,
        "iterations": iterations,
        "task_risks": sorted(normalized, key=lambda row: row["task_id"]),
        "correlations": correlations,
    }


def validate_risk_result(inputs: dict[str, Any], result: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    percentiles = result.get("finish_percentiles", {})
    dates = [percentiles.get(key) for key in ("p50", "p80", "p90", "p95")]
    if any(not value for value in dates) or dates != sorted(dates):
        issues.append(_issue("risk_percentile_order", "Finish percentiles must be present and monotonic."))
    duration_values = [result.get("duration_percentiles_days", {}).get(key) for key in ("p50", "p80", "p90", "p95")]
    if any(not isinstance(value, int) for value in duration_values) or duration_values != sorted(duration_values):
        issues.append(_issue("risk_duration_percentile_order", "Duration percentiles must be integer and monotonic."))
    if result.get("sample_count") != inputs.get("iterations"):
        issues.append(_issue("risk_sample_count", "Result sample count does not match requested iterations."))
    probability = result.get("probability_on_or_before_target")
    if not isinstance(probability, (int, float)) or not 0 <= probability <= 1:
        issues.append(_issue("risk_probability_range", "Target completion probability must be between zero and one."))
    return issues


def _snapshot_schedule(snapshot: dict[str, Any]) -> tuple[list[dict[str, Any]], list[PlanningTaskDependency], CalendarSpec, date, date]:
    approved = snapshot["approved"]
    preview = {str(row["id"]): row for row in snapshot["preview"]["tasks"]}
    templates = [{**row, **preview.get(str(row["id"]), {})} for row in approved["tasks"]]
    dependencies = [PlanningTaskDependency(**{
        "id": row["id"], "organization_id": "snapshot", "project_id": approved["project"]["id"],
        "predecessor_task_id": row["predecessor_task_id"], "successor_task_id": row["successor_task_id"],
        "dependency_type": row["dependency_type"], "lag_days": row["lag_days"],
    }) for row in approved["dependencies"]]
    raw_calendar = approved["calendar"]
    holidays = {date.fromisoformat(value) for value in calendar_holidays(raw_calendar)}
    holidays.update(calendar_ignored_dates(raw_calendar))
    calendar = CalendarSpec(frozenset(raw_calendar.get("working_days") or [1, 2, 3, 4, 5]), frozenset(holidays))
    return templates, dependencies, calendar, date.fromisoformat(approved["project"]["start"]), date.fromisoformat(approved["project"]["target_finish"])


def _task_with_duration(row: dict[str, Any], duration: int | None, calendar: CalendarSpec) -> PlanningTask:
    start = date.fromisoformat(row["start"])
    days = int(duration if duration is not None else row["duration_days"])
    end = start if row["task_type"] == "milestone" else _finish(start, days, calendar)
    return PlanningTask(
        id=row["id"], organization_id="snapshot", project_id=row["project_id"], parent_task_id=row.get("parent_task_id"),
        title=row["title"], task_type=row["task_type"], status=row["status"], start_at=at_utc(start), end_at=at_utc(end),
        duration_days=0 if row["task_type"] == "milestone" else days, progress=int(row["progress"]),
        sort_order=int(row["sort_order"]), version=int(row.get("version") or 1), attrs_json=dumps(row.get("attributes", {})),
    )


def _sample_duration(spec: dict[str, Any], rng: Random, group_uniforms: dict[str, float], correlations: dict[str, float]) -> int:
    individual = rng.random()
    group = spec.get("correlation_group")
    coefficient = correlations.get(str(group), 0.0) if group else 0.0
    uniform = coefficient * group_uniforms.get(str(group), individual) + (1 - coefficient) * individual
    value = _triangular_quantile(uniform, spec["minimum_days"], spec["most_likely_days"], spec["maximum_days"])
    return max(1, round(value))


def _triangular_quantile(value: float, minimum: int, mode: int, maximum: int) -> float:
    if maximum == minimum:
        return float(minimum)
    split = (mode - minimum) / (maximum - minimum)
    if value <= split:
        return minimum + sqrt(value * (maximum - minimum) * (mode - minimum))
    return maximum - sqrt((1 - value) * (maximum - minimum) * (maximum - mode))


def _risk_result(finishes: list[date], durations: list[int], target: date, inputs: dict[str, Any]) -> dict[str, Any]:
    ordered_finish = sorted(finishes)
    ordered_duration = sorted(durations)
    return {
        "sample_count": len(finishes),
        "finish_percentiles": {key: _percentile(ordered_finish, value).isoformat() for key, value in (("p50", .5), ("p80", .8), ("p90", .9), ("p95", .95))},
        "duration_percentiles_days": {key: _percentile(ordered_duration, value) for key, value in (("p50", .5), ("p80", .8), ("p90", .9), ("p95", .95))},
        "probability_on_or_before_target": round(sum(value <= target for value in finishes) / len(finishes), 6),
        "target_finish": target.isoformat(),
        "confidence": {"method": "deterministic_empirical_percentiles", "iterations": inputs["iterations"]},
        "assumptions": {"dependency_engine": "uok-cpm-1", "correlation_method": "bounded_uniform_rank_blend"},
    }


def _finish(start: date, duration: int, calendar: CalendarSpec) -> date:
    current, remaining = start, max(1, duration)
    while True:
        if calendar.is_working_day(current):
            remaining -= 1
            if remaining == 0:
                return current
        current += timedelta(days=1)


def _percentile(values: list[Any], percentile: float) -> Any:
    return values[max(0, ceil(percentile * len(values)) - 1)]


def _correlations(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list) or len(value) > 50:
        raise ValueError("correlations must contain at most 50 rows")
    rows: list[dict[str, Any]] = []
    found: set[str] = set()
    for raw in value:
        group = str(raw.get("group") or "").strip() if isinstance(raw, dict) else ""
        coefficient = raw.get("coefficient") if isinstance(raw, dict) else None
        if not group or len(group) > 80 or group in found or isinstance(coefficient, bool) or not isinstance(coefficient, (int, float)) or not 0 <= coefficient <= .95:
            raise ValueError("correlations require unique groups and coefficients from 0 through 0.95")
        rows.append({"group": group, "coefficient": float(coefficient)})
        found.add(group)
    return sorted(rows, key=lambda row: row["group"])


def _bounded_int(value: Any, field: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{field} must be an integer between {minimum} and {maximum}")
    return value


def _issue(code: str, message: str) -> dict[str, Any]:
    return {"code": code, "message": message, "object_ids": []}


__all__ = ["RISK_ENGINE_NAME", "RISK_ENGINE_VERSION", "risk_inputs", "run_risk_engine", "validate_risk_result"]
