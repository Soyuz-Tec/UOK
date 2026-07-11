"""Compatibility aliases for Planning-owned schedule ORM models."""

from datetime import datetime, timezone
from uuid import uuid4

from .models import (
    PlanningBaseline,
    PlanningCalendar,
    PlanningLink,
    PlanningProject,
    PlanningScheduleEvent,
    PlanningTask,
    PlanningTaskDependency,
    PlanningTaskParticipant,
    PlanningTaskRequirement,
)


def planning_id() -> str:
    return str(uuid4())


def planning_now() -> datetime:
    return datetime.now(timezone.utc)


__all__ = [
    "PlanningBaseline",
    "PlanningCalendar",
    "PlanningLink",
    "PlanningProject",
    "PlanningScheduleEvent",
    "PlanningTask",
    "PlanningTaskDependency",
    "PlanningTaskParticipant",
    "PlanningTaskRequirement",
    "planning_id",
    "planning_now",
]
