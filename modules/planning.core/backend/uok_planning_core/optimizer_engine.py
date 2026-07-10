from __future__ import annotations

from time import monotonic
from typing import Any

from .cpm import calculate_cpm
from .cpm_validation import validate_cpm_result
from .risk_engine import _snapshot_schedule, _task_with_duration
from .scheduler import validate_schedule
from .schedule_math import working_duration

OPTIMIZER_ENGINE_NAME = "uok-bounded-schedule-optimizer"
OPTIMIZER_ENGINE_VERSION = "2"
MAX_OPTIMIZER_CANDIDATES = 100
MAX_OPTIMIZER_TIMEOUT_MS = 2000


def run_optimizer(snapshot: dict[str, Any], raw_inputs: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    inputs = optimizer_inputs(raw_inputs)
    templates, dependencies, calendar, project_start, target_finish = _snapshot_schedule(snapshot)
    baseline_tasks = [_task_with_duration(row, None, calendar) for row in templates]
    baseline = calculate_cpm(baseline_tasks, dependencies, calendar, project_start, target_finish)
    eligible = [
        row for row in templates
        if row["task_type"] == "task" and row.get("scheduling_mode", "auto") == "auto" and int(row["duration_days"]) > 1
    ]
    eligible.sort(key=lambda row: (not bool(row.get("critical")), -int(row["duration_days"]), str(row["id"])))
    started = monotonic()
    candidates: list[dict[str, Any]] = []
    timed_out = False
    evaluated = 0
    for row in eligible[:inputs["max_candidates"]]:
        if (monotonic() - started) * 1000 >= inputs["timeout_ms"]:
            timed_out = True
            break
        evaluated += 1
        candidate = _evaluate_candidate(row, templates, dependencies, calendar, project_start, target_finish, baseline)
        if candidate:
            candidates.append(candidate)
    candidates.sort(key=lambda item: (-item["objective"]["improvement_working_days"], item["effort"]["task_days"], item["key"]))
    recommendations = [{**row, "rank": index} for index, row in enumerate(candidates[:5], start=1)]
    status = "timeout" if timed_out else "completed" if recommendations else "infeasible"
    limits = {
        "timeout_ms": inputs["timeout_ms"],
        "max_candidates": inputs["max_candidates"],
        "eligible_candidates": len(eligible),
        "evaluated_candidates": evaluated,
        "returned_recommendations": len(recommendations),
    }
    explanations = _explanations(baseline, eligible, recommendations, timed_out)
    result = {
        "status": status,
        "objective": {
            "name": "minimize_project_finish",
            "baseline_finish": baseline.calculated_finish.isoformat(),
            "target_finish": target_finish.isoformat(),
        },
        "analysis": {
            "critical_task_ids": sorted(task_id for task_id, metric in baseline.task_metrics.items() if metric.critical),
            "baseline_target_variance_days": baseline.target_variance_days,
        },
        "explanations": explanations,
        "recommendations": recommendations,
    }
    issues = validate_optimizer_result(snapshot, inputs, result)
    result["independent_validation"] = {"ok": not issues, "violations": issues}
    return inputs, limits, result


def optimizer_inputs(raw: dict[str, Any]) -> dict[str, Any]:
    objective = str(raw.get("objective") or "minimize_project_finish")
    if objective != "minimize_project_finish":
        raise ValueError("objective must be minimize_project_finish")
    timeout_ms = _bounded_int(raw.get("timeout_ms", 500), "timeout_ms", 1, MAX_OPTIMIZER_TIMEOUT_MS)
    max_candidates = _bounded_int(raw.get("max_candidates", 50), "max_candidates", 1, MAX_OPTIMIZER_CANDIDATES)
    return {"objective": objective, "timeout_ms": timeout_ms, "max_candidates": max_candidates}


def validate_optimizer_result(snapshot: dict[str, Any], inputs: dict[str, Any], result: dict[str, Any]) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    recommendations = result.get("recommendations", [])
    if result.get("status") == "completed" and not recommendations:
        issues.append(_issue("optimizer_result_empty", "A completed optimizer result must contain a recommendation."))
    if result.get("status") == "infeasible" and recommendations:
        issues.append(_issue("optimizer_infeasible_has_result", "An infeasible optimizer result cannot contain recommendations."))
    if len(recommendations) > min(5, inputs["max_candidates"]):
        issues.append(_issue("optimizer_result_limit", "Returned recommendations exceed the configured limit."))
    seen: set[str] = set()
    for index, recommendation in enumerate(recommendations, start=1):
        if recommendation.get("rank") != index or recommendation.get("key") in seen:
            issues.append(_issue("optimizer_rank", "Recommendation ranks and keys must be unique and ordered."))
        seen.add(str(recommendation.get("key")))
        preview = recommendation.get("preview", {})
        if not preview.get("validation", {}).get("ok") or recommendation.get("objective", {}).get("improvement_working_days", 0) <= 0:
            issues.append(_issue("optimizer_hard_constraint", "Every recommendation must improve the objective and pass hard-constraint validation."))
    return issues


def _evaluate_candidate(
    target: dict[str, Any],
    templates: list[dict[str, Any]],
    dependencies: list[Any],
    calendar: Any,
    project_start: Any,
    target_finish: Any,
    baseline: Any,
) -> dict[str, Any] | None:
    next_duration = int(target["duration_days"]) - 1
    tasks = [_task_with_duration(row, next_duration if row["id"] == target["id"] else None, calendar) for row in templates]
    analysis = calculate_cpm(tasks, dependencies, calendar, project_start, target_finish)
    schedule_violations = validate_schedule(tasks, dependencies, calendar)
    cpm_issues = validate_cpm_result(tasks, dependencies, calendar, analysis)
    improvement = working_duration(analysis.calculated_finish, baseline.calculated_finish, calendar) - 1 if analysis.calculated_finish < baseline.calculated_finish else 0
    if schedule_violations or cpm_issues or improvement <= 0:
        return None
    changed = next(task for task in tasks if task.id == target["id"])
    return {
        "key": f"compress:{target['id']}:1d",
        "title": f"Compress {target['title']} by one working day",
        "explanation": {
            "why": "This auto-scheduled critical task controls the calculated finish.",
            "impact": f"Calculated finish improves by {improvement} working day(s).",
            "side_effects": ["Requires delivery owner confirmation that the shorter duration is feasible."],
            "assumptions": ["Dependencies, calendars, and constraints remain unchanged.", "No resource allocation is added."],
        },
        "effort": {"task_days": 1, "classification": "requires_owner_validation"},
        "objective": {
            "baseline_finish": baseline.calculated_finish.isoformat(),
            "candidate_finish": analysis.calculated_finish.isoformat(),
            "improvement_working_days": improvement,
        },
        "proposal": {"task_changes": [{
            "task_id": target["id"],
            "before": {"start": target["start"], "end": target["end"], "duration_days": int(target["duration_days"])},
            "after": {"start": changed.start_at.date().isoformat(), "end": changed.end_at.date().isoformat(), "duration_days": next_duration},
        }]},
        "preview": {
            "calculated_finish": analysis.calculated_finish.isoformat(),
            "target_variance_days": analysis.target_variance_days,
            "validation": {"ok": True, "violations": []},
        },
    }


def _explanations(baseline: Any, eligible: list[dict[str, Any]], recommendations: list[dict[str, Any]], timed_out: bool) -> list[dict[str, str]]:
    values = [{"code": "critical_path", "message": f"Calculated finish is {baseline.calculated_finish.isoformat()} with target variance {baseline.target_variance_days} day(s)."}]
    if not eligible:
        values.append({"code": "no_compressible_auto_task", "message": "No auto-scheduled task longer than one day can be evaluated."})
    elif not recommendations and not timed_out:
        values.append({"code": "no_improving_candidate", "message": "Bounded candidates did not improve finish while preserving hard constraints."})
    if timed_out:
        values.append({"code": "time_limit_reached", "message": "The configured optimizer time limit was reached; returned results may be partial."})
    return values


def _bounded_int(value: Any, field: str, minimum: int, maximum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ValueError(f"{field} must be an integer between {minimum} and {maximum}")
    return value


def _issue(code: str, message: str) -> dict[str, Any]:
    return {"code": code, "message": message, "object_ids": []}


__all__ = ["OPTIMIZER_ENGINE_NAME", "OPTIMIZER_ENGINE_VERSION", "optimizer_inputs", "run_optimizer", "validate_optimizer_result"]
