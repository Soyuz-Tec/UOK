from __future__ import annotations

from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from uok_planning_core._internal.persistence.models import PlanningProject, PlanningScheduleEvent, PlanningTask, PlanningTaskDependency
from uok.kernel.module_runtime import module_declared
from uok.kernel_models import EventRecord, ModuleRecord
from uok.kernel.security import Actor


def dashboard_counts(db: Session, actor: Actor) -> dict[str, int]:
    return {
        "planning_projects": db.scalar(select(func.count(PlanningProject.id)).where(
            PlanningProject.organization_id == actor.organization_id,
            PlanningProject.status != "purged",
        )) or 0,
        "planning_tasks": db.scalar(
            select(func.count(PlanningTask.id))
            .select_from(PlanningTask)
            .join(
                PlanningProject,
                and_(
                    PlanningProject.id == PlanningTask.project_id,
                    PlanningProject.organization_id == PlanningTask.organization_id,
                ),
            )
            .where(
                PlanningTask.organization_id == actor.organization_id,
                PlanningProject.organization_id == actor.organization_id,
                PlanningProject.status != "purged",
            )
        ) or 0,
    }


def evidence(db: Session, organization_id: str) -> dict[str, Any]:
    event_types = set(db.scalars(select(EventRecord.event_type).where(EventRecord.organization_id == organization_id)).all())
    projects = db.scalar(select(func.count(PlanningProject.id)).where(PlanningProject.organization_id == organization_id)) or 0
    tasks = db.scalar(select(func.count(PlanningTask.id)).where(PlanningTask.organization_id == organization_id)) or 0
    dependencies = db.scalar(select(func.count(PlanningTaskDependency.id)).where(PlanningTaskDependency.organization_id == organization_id)) or 0
    schedule_events = db.scalar(select(func.count(PlanningScheduleEvent.id)).where(PlanningScheduleEvent.organization_id == organization_id)) or 0
    module = db.scalar(select(ModuleRecord).where(
        ModuleRecord.organization_id == organization_id,
        ModuleRecord.name == "planning.core",
    ))
    operational = module is not None and module.status in {"installed", "upgraded"}
    checks = {
        "planning_module_available_to_install": module_declared("planning.core"),
        "planning_module_operational": not module or operational,
        "planning_project_available": not operational or projects > 0,
        "planning_tasks_available": not operational or tasks >= 2,
        "planning_dependencies_available": not operational or dependencies > 0,
        "planning_schedule_events_available": not operational or schedule_events >= 3,
        "planning_events_present": not operational or {
            "PlanningProjectCreated",
            "PlanningTaskCreated",
            "PlanningTaskLinked",
        }.issubset(event_types),
    }
    return {
        "checks": checks,
        "counts": {
            "planning_projects": projects,
            "planning_tasks": tasks,
            "planning_dependencies": dependencies,
            "planning_schedule_events": schedule_events,
        },
    }
