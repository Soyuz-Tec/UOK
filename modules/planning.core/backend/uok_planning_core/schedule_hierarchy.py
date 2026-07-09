from __future__ import annotations

from .models import PlanningTask


def hierarchy_violations(tasks: list[PlanningTask]) -> list[str]:
    task_ids = {task.id for task in tasks}
    violations: list[str] = []
    for task in tasks:
        if task.parent_task_id and task.parent_task_id not in task_ids:
            violations.append(f"{task.title} references a missing parent task")
        seen: set[str] = set()
        current = task
        while current.parent_task_id:
            if current.parent_task_id in seen or current.parent_task_id == task.id:
                violations.append("schedule contains a hierarchy cycle")
                break
            seen.add(current.parent_task_id)
            parent = next((item for item in tasks if item.id == current.parent_task_id), None)
            if not parent:
                break
            current = parent
    return violations
