from __future__ import annotations

from uok.models import (
    PlanningAssignment,
    PlanningBaseline,
    PlanningCalendar,
    PlanningLink,
    PlanningProject,
    PlanningResource,
    PlanningScheduleEvent,
    PlanningTask,
    PlanningTaskDependency,
    utcnow,
)

__all__ = [
    "PlanningAssignment",
    "PlanningBaseline",
    "PlanningCalendar",
    "PlanningLink",
    "PlanningProject",
    "PlanningResource",
    "PlanningScheduleEvent",
    "PlanningTask",
    "PlanningTaskDependency",
    "owned_models",
    "utcnow",
]


def owned_models() -> dict[str, str]:
    return {
        "PlanningAssignment": PlanningAssignment.__tablename__,
        "PlanningBaseline": PlanningBaseline.__tablename__,
        "PlanningCalendar": PlanningCalendar.__tablename__,
        "PlanningLink": PlanningLink.__tablename__,
        "PlanningProject": PlanningProject.__tablename__,
        "PlanningResource": PlanningResource.__tablename__,
        "PlanningScheduleEvent": PlanningScheduleEvent.__tablename__,
        "PlanningTask": PlanningTask.__tablename__,
        "PlanningTaskDependency": PlanningTaskDependency.__tablename__,
    }
