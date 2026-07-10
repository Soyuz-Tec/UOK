from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from .advanced_commands import clean_text
from .models import PlanningProject
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .read_model import schedule_read_model
from .scheduler import apply_schedule, project_or_error, task_or_error
from .task_mutations import apply_task_update
from uok.command_context import CommandDomainError
from uok.security import Actor

MAX_BATCH_OPERATIONS = 500
TASK_UPDATE_FIELDS = {
    "task_id", "title", "task_type", "parent_task_id", "start", "end", "status",
    "progress", "sort_order", "scheduling_mode", "constraint_type", "constraint_date", "cascade",
}


def cmd_batch_operations(
    db: Session,
    actor: Actor,
    payload: dict[str, Any],
    command_id: str,
) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    reason = str(payload.get("reason") or "").strip()
    if len(reason) > 500:
        raise _batch_error(project.revision, command_id, "batch_reason_invalid", "reason must be 500 characters or fewer.", "reason", "Shorten the reason and retry the complete batch.")
    operations = payload.get("operations")
    if not isinstance(operations, list) or not 1 <= len(operations) <= MAX_BATCH_OPERATIONS:
        raise _batch_error(
            project.revision,
            command_id,
            "batch_operations_invalid",
            f"operations must contain between 1 and {MAX_BATCH_OPERATIONS} items.",
            "operations",
            "Submit one ordered, non-empty batch within the documented operation limit.",
        )
    results, direct_task_ids, cascade_dependencies = _apply_operations(db, actor, project, operations, command_id)

    db.flush()
    try:
        changed_task_ids = direct_task_ids | apply_schedule(db, actor, project.id, cascade_dependencies=cascade_dependencies)
    except ValueError as exc:
        raise _batch_error(
            project.revision,
            command_id,
            "batch_final_schedule_invalid",
            str(exc),
            "operations",
            "Revise the ordered operations so their final proposed schedule satisfies every hard constraint.",
            sorted(direct_task_ids),
        ) from exc
    _emit_batch_events(db, actor, project.id, command_id, reason, results, changed_task_ids)
    return {
        "correlation_id": command_id,
        "previous_revision": int(project.revision),
        "operation_results": results,
        "schedule": schedule_read_model(db, actor, project),
    }


def _apply_operations(
    db: Session,
    actor: Actor,
    project: PlanningProject,
    operations: list[Any],
    command_id: str,
) -> tuple[list[dict[str, Any]], set[str], bool]:
    results: list[dict[str, Any]] = []
    operation_ids: set[str] = set()
    direct_task_ids: set[str] = set()
    cascade_dependencies = False
    for index, operation in enumerate(operations):
        operation_id, kind, operation_payload = _operation_envelope(operation, index, operation_ids, project.revision, command_id)
        if kind != "update_task":
            raise _batch_error(
                project.revision,
                command_id,
                "batch_operation_unsupported",
                f"Batch operation kind {kind!r} is not available in this slice.",
                f"operations[{index}].kind",
                "Use update_task, or submit the unsupported action through its existing single-mutation endpoint.",
            )
        try:
            _validate_task_payload(operation_payload)
            task_id = clean_text(operation_payload.get("task_id"), "task_id", 36)
            task = task_or_error(db, actor, task_id, project.id)
            apply_task_update(db, actor, project, task, operation_payload)
        except ValueError as exc:
            raise _batch_error(
                project.revision,
                command_id,
                "batch_operation_invalid",
                str(exc),
                f"operations[{index}].payload",
                "Correct this operation and retry the complete batch with the same current schedule ETag.",
                [str(operation_payload.get("task_id") or "")],
            ) from exc
        direct_task_ids.add(task.id)
        cascade_dependencies = cascade_dependencies or bool(operation_payload.get("cascade", True))
        results.append({"operation_id": operation_id, "status": "applied", "object_ids": [task.id]})
    return results, direct_task_ids, cascade_dependencies


def _validate_task_payload(payload: dict[str, Any]) -> None:
    unknown = sorted(set(payload) - TASK_UPDATE_FIELDS)
    if unknown:
        raise ValueError(f"update_task payload contains unsupported fields: {', '.join(unknown)}")
    if "cascade" in payload and not isinstance(payload["cascade"], bool):
        raise ValueError("cascade must be true or false")


def _operation_envelope(
    operation: Any,
    index: int,
    operation_ids: set[str],
    revision: int,
    command_id: str,
) -> tuple[str, str, dict[str, Any]]:
    if not isinstance(operation, dict):
        raise _batch_error(revision, command_id, "batch_operation_invalid", "Each operation must be an object.", f"operations[{index}]", "Submit an operation_id, kind, and payload object.")
    operation_id = str(operation.get("operation_id") or "").strip()
    if not operation_id or len(operation_id) > 80 or operation_id in operation_ids:
        raise _batch_error(revision, command_id, "batch_operation_id_invalid", "operation_id must be unique and 1 to 80 characters.", f"operations[{index}].operation_id", "Give every operation a stable unique identifier within this batch.")
    kind = str(operation.get("kind") or "").strip()
    operation_payload = operation.get("payload")
    if not isinstance(operation_payload, dict):
        raise _batch_error(revision, command_id, "batch_operation_invalid", "operation payload must be an object.", f"operations[{index}].payload", "Submit the fields required by the selected operation kind.")
    operation_ids.add(operation_id)
    return operation_id, kind, operation_payload


def _emit_batch_events(
    db: Session,
    actor: Actor,
    project_id: str,
    command_id: str,
    reason: str,
    results: list[dict[str, Any]],
    changed_task_ids: set[str],
) -> None:
    payload = {
        "project_id": project_id,
        "correlation_id": command_id,
        "reason": reason,
        "operation_ids": [row["operation_id"] for row in results],
        "changed_task_ids": sorted(changed_task_ids),
    }
    emit_planning_event(db, actor, command_id, "PlanningBatchApplied", "PlanningProject", project_id, payload)
    add_planning_schedule_event(db, actor, command_id, project_id, "batch_applied", payload)


def _batch_error(
    revision: int,
    command_id: str,
    code: str,
    message: str,
    field: str,
    repair: str,
    object_ids: list[str] | None = None,
) -> CommandDomainError:
    return CommandDomainError(
        code=code,
        message=message,
        field=field,
        object_ids=[item for item in (object_ids or []) if item],
        repair=repair,
        current_revision=int(revision),
        correlation_id=command_id,
    )
