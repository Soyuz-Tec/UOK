from __future__ import annotations

from typing import Any, Callable

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .advanced_commands import bounded_int, clean_text, cmd_assign_resource, cmd_create_baseline, cmd_create_resource, cmd_set_calendar
from .batch import cmd_batch_operations
from .concurrency import guarded_planning_command
from .leveling_command import cmd_level_resources
from .date_commands import cmd_update_planning_task_dates
from .date_semantics import planning_timezone
from .link_commands import cmd_create_planning_link, cmd_remove_planning_link
from .participant_commands import cmd_add_planning_task_participant, cmd_remove_planning_task_participant
from .requirement_commands import cmd_advance_planning_task_requirement, cmd_create_planning_task_requirement, cmd_decide_planning_task_requirement, cmd_set_planning_task_requirement_link
from .resource_calendar_commands import cmd_set_resource_calendar
from .models import (
    PlanningAssignment,
    PlanningProject,
    PlanningTask,
    PlanningTaskDependency,
    utcnow,
)
from .planning_audit import add_planning_schedule_event, emit_planning_event
from .read_model import schedule_read_model, serialize_project, serialize_task
from .scheduler import (
    DEPENDENCY_TYPES,
    apply_schedule,
    assert_task_dependency_position,
    parse_planning_date,
    project_calendar,
    project_dependencies,
    project_or_error,
    project_tasks,
    task_or_error,
    validate_schedule,
)
from .status_policy import planning_task_status
from .task_mutations import apply_task_update, assert_parent_valid, planning_task_type, recalculate_task_duration
from .task_constraints import set_task_planning_attrs
from uok.security import Actor

CommandHandler = Callable[[Session, Actor, dict[str, Any], str], dict[str, Any]]


def cmd_create_project(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    name = clean_text(payload.get("name"), "name", 180)
    start = parse_planning_date(payload.get("start"), "start")
    end = parse_planning_date(payload.get("end"), "end")
    if end < start:
        raise ValueError("project end must be on or after start")
    project = PlanningProject(
        organization_id=actor.organization_id,
        name=name,
        start_at=start,
        end_at=end,
        timezone_name=planning_timezone(payload.get("timezone")),
        updated_at=utcnow(),
    )
    db.add(project)
    db.flush()
    emit_planning_event(db, actor, command_id, "PlanningProjectCreated", "PlanningProject", project.id, {"name": name})
    add_planning_schedule_event(db, actor, command_id, project.id, "project_created", {"name": name})
    return serialize_project(project)


def cmd_create_task(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    calendar = project_calendar(db, actor, project.id)
    task = _task_from_payload(actor, project.id, payload, calendar)
    assert_parent_valid(db, actor, project.id, task.parent_task_id)
    db.add(task)
    project.updated_at = utcnow()
    db.flush()
    changed = apply_schedule(db, actor, project.id)
    _assert_schedule_valid(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningTaskCreated", "PlanningTask", task.id, {"project_id": project.id, "title": task.title})
    add_planning_schedule_event(db, actor, command_id, project.id, "task_created", {"task_id": task.id, "changed_task_ids": sorted(changed)})
    return serialize_task(task, project_timezone=project.timezone_name)


def cmd_update_task(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    apply_task_update(db, actor, project, task, payload, command_id)
    tasks = project_tasks(db, actor, project.id)
    dependencies = project_dependencies(db, actor, project.id)
    assert_task_dependency_position(task, tasks, dependencies, project_calendar(db, actor, project.id))
    changed = apply_schedule(db, actor, project.id, cascade_dependencies=bool(payload.get("cascade", True)))
    _assert_schedule_valid(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningTaskUpdated", "PlanningTask", task.id, {"project_id": project.id, "title": task.title})
    add_planning_schedule_event(db, actor, command_id, project.id, "task_updated", {"task_id": task.id, "changed_task_ids": sorted(changed)})
    return {"task": serialize_task(task, project_timezone=project.timezone_name), "validation": schedule_read_model(db, actor, project)["validation"]}


def cmd_delete_task(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    task = task_or_error(db, actor, clean_text(payload.get("task_id"), "task_id", 36))
    project = project_or_error(db, actor, task.project_id)
    task_ids = _task_subtree_ids(project_tasks(db, actor, project.id), task.id)
    for row in project_tasks(db, actor, project.id):
        if row.id in task_ids:
            row.status = "deleted"
            row.updated_at = utcnow()
    db.execute(delete(PlanningTaskDependency).where(
        PlanningTaskDependency.organization_id == actor.organization_id,
        PlanningTaskDependency.project_id == project.id,
        PlanningTaskDependency.predecessor_task_id.in_(task_ids) | PlanningTaskDependency.successor_task_id.in_(task_ids),
    ))
    db.execute(delete(PlanningAssignment).where(
        PlanningAssignment.organization_id == actor.organization_id,
        PlanningAssignment.task_id.in_(task_ids),
    ))
    project.updated_at = utcnow()
    changed = apply_schedule(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningTaskDeleted", "PlanningTask", task.id, {"project_id": project.id})
    add_planning_schedule_event(db, actor, command_id, project.id, "task_deleted", {"task_ids": sorted(task_ids), "changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def cmd_link_tasks(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    project = project_or_error(db, actor, clean_text(payload.get("project_id"), "project_id", 36))
    predecessor = task_or_error(db, actor, clean_text(payload.get("predecessor_task_id"), "predecessor_task_id", 36), project.id)
    successor = task_or_error(db, actor, clean_text(payload.get("successor_task_id"), "successor_task_id", 36), project.id)
    dep = PlanningTaskDependency(
        organization_id=actor.organization_id,
        project_id=project.id,
        predecessor_task_id=predecessor.id,
        successor_task_id=successor.id,
        dependency_type=_dependency_type(payload.get("dependency_type")),
        lag_days=bounded_int(payload.get("lag_days", 0), "lag_days", -30, 30),
    )
    db.add(dep)
    project.updated_at = utcnow()
    db.flush()
    changed = apply_schedule(db, actor, project.id)
    _assert_schedule_valid(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningTaskLinked", "PlanningTaskDependency", dep.id, {"project_id": project.id})
    add_planning_schedule_event(db, actor, command_id, project.id, "task_linked", {"dependency_id": dep.id, "changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def cmd_update_dependency(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    dep = _dependency_or_error(db, actor, clean_text(payload.get("dependency_id"), "dependency_id", 36))
    project = project_or_error(db, actor, dep.project_id)
    if "dependency_type" in payload:
        dep.dependency_type = _dependency_type(payload.get("dependency_type"))
    if "lag_days" in payload:
        dep.lag_days = bounded_int(payload.get("lag_days", 0), "lag_days", -30, 30)
    changed = apply_schedule(db, actor, project.id)
    _assert_schedule_valid(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningDependencyUpdated", "PlanningTaskDependency", dep.id, {"project_id": project.id})
    add_planning_schedule_event(db, actor, command_id, project.id, "dependency_updated", {"dependency_id": dep.id, "changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def cmd_remove_dependency(db: Session, actor: Actor, payload: dict[str, Any], command_id: str) -> dict[str, Any]:
    dep = _dependency_or_error(db, actor, clean_text(payload.get("dependency_id"), "dependency_id", 36))
    project = project_or_error(db, actor, dep.project_id)
    dep_id = dep.id
    db.delete(dep)
    changed = apply_schedule(db, actor, project.id)
    emit_planning_event(db, actor, command_id, "PlanningDependencyRemoved", "PlanningTaskDependency", dep_id, {"project_id": project.id})
    add_planning_schedule_event(db, actor, command_id, project.id, "dependency_removed", {"dependency_id": dep_id, "changed_task_ids": sorted(changed)})
    return schedule_read_model(db, actor, project)


def command_handlers() -> dict[str, CommandHandler]:
    handlers = {
        "CreatePlanningProject": cmd_create_project,
        "CreatePlanningTask": cmd_create_task,
        "UpdatePlanningTask": cmd_update_task,
        "UpdatePlanningTaskDates": cmd_update_planning_task_dates,
        "DeletePlanningTask": cmd_delete_task,
        "LinkPlanningTasks": cmd_link_tasks,
        "UpdatePlanningDependency": cmd_update_dependency,
        "RemovePlanningDependency": cmd_remove_dependency,
        "SetPlanningCalendar": cmd_set_calendar,
        "CreatePlanningBaseline": cmd_create_baseline,
        "CreatePlanningResource": cmd_create_resource,
        "SetPlanningResourceCalendar": cmd_set_resource_calendar,
        "AssignPlanningResource": cmd_assign_resource,
        "LevelPlanningResources": cmd_level_resources,
        "BatchPlanningOperations": cmd_batch_operations,
        "CreatePlanningLink": cmd_create_planning_link,
        "RemovePlanningLink": cmd_remove_planning_link,
        "AddPlanningTaskParticipant": cmd_add_planning_task_participant,
        "RemovePlanningTaskParticipant": cmd_remove_planning_task_participant,
        "CreatePlanningTaskRequirement": cmd_create_planning_task_requirement,
        "AdvancePlanningTaskRequirement": cmd_advance_planning_task_requirement,
        "SetPlanningTaskRequirementLink": cmd_set_planning_task_requirement_link,
        "DecidePlanningTaskRequirement": cmd_decide_planning_task_requirement,
    }
    return {name: guarded_planning_command(name, handler) for name, handler in handlers.items()}


def command_permissions() -> dict[str, str]:
    edit_commands = {
        "CreatePlanningProject",
        "CreatePlanningTask",
        "UpdatePlanningTask",
        "UpdatePlanningTaskDates",
        "DeletePlanningTask",
        "LinkPlanningTasks",
        "UpdatePlanningDependency",
        "RemovePlanningDependency",
        "SetPlanningCalendar",
        "CreatePlanningResource",
        "SetPlanningResourceCalendar",
        "AssignPlanningResource",
        "BatchPlanningOperations",
        "AddPlanningTaskParticipant",
        "RemovePlanningTaskParticipant",
        "CreatePlanningTaskRequirement",
        "AdvancePlanningTaskRequirement",
        "SetPlanningTaskRequirementLink",
    }
    permissions = {command: "planning.edit" for command in edit_commands}
    permissions["CreatePlanningBaseline"] = "planning.baseline.create"
    permissions["LevelPlanningResources"] = "planning.level"
    permissions["CreatePlanningLink"] = "planning.link"
    permissions["RemovePlanningLink"] = "planning.link"
    permissions["DecidePlanningTaskRequirement"] = "planning.gate.approve"
    return permissions


def _task_from_payload(actor: Actor, project_id: str, payload: dict[str, Any], calendar: Any | None = None) -> PlanningTask:
    start = parse_planning_date(payload.get("start"), "start")
    end = parse_planning_date(payload.get("end"), "end")
    if end < start:
        raise ValueError("task end must be on or after start")
    task = PlanningTask(
        organization_id=actor.organization_id,
        project_id=project_id,
        parent_task_id=str(payload["parent_task_id"]) if payload.get("parent_task_id") else None,
        title=clean_text(payload.get("title"), "title", 180),
        task_type=planning_task_type(payload.get("task_type")),
        status=planning_task_status(payload.get("status")),
        start_at=start,
        end_at=end,
        progress=bounded_int(payload.get("progress", 0), "progress", 0, 100),
        sort_order=bounded_int(payload.get("sort_order", 0), "sort_order", 0, 100000),
        updated_at=utcnow(),
    )
    recalculate_task_duration(task, calendar)
    set_task_planning_attrs(task, payload)
    return task


def _assert_schedule_valid(db: Session, actor: Actor, project_id: str) -> None:
    violations = validate_schedule(project_tasks(db, actor, project_id), project_dependencies(db, actor, project_id), project_calendar(db, actor, project_id))
    if violations:
        raise ValueError("; ".join(violations))


def _dependency_or_error(db: Session, actor: Actor, dependency_id: str) -> PlanningTaskDependency:
    dep = db.get(PlanningTaskDependency, dependency_id)
    if not dep or dep.organization_id != actor.organization_id:
        raise ValueError("dependency_id not found")
    return dep


def _dependency_type(value: Any) -> str:
    dependency_type = str(value or "finish_to_start")
    if dependency_type not in DEPENDENCY_TYPES:
        raise ValueError("dependency_type must be finish_to_start, start_to_start, finish_to_finish, or start_to_finish")
    return dependency_type


def _task_subtree_ids(tasks: list[PlanningTask], task_id: str) -> set[str]:
    children: dict[str, list[str]] = {}
    for row in tasks:
        if row.parent_task_id:
            children.setdefault(row.parent_task_id, []).append(row.id)
    found = {task_id}
    stack = [task_id]
    while stack:
        current = stack.pop()
        for child_id in children.get(current, []):
            found.add(child_id)
            stack.append(child_id)
    return found
