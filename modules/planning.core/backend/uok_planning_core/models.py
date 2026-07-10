from __future__ import annotations

from uok.models import (
    PlanningAssignment,
    PlanningBaseline,
    PlanningCalendar,
    PlanningLink,
    PlanningProject,
    PlanningResource,
    PlanningResourceCalendar,
    PlanningScheduleEvent,
    PlanningTask,
    PlanningTaskParticipant,
    PlanningTaskRequirement,
    PlanningTaskDependency,
    PlanningWhatIfSnapshot,
    utcnow,
)

__all__ = [
    "PlanningAssignment",
    "PlanningBaseline",
    "PlanningCalendar",
    "PlanningLink",
    "PlanningProject",
    "PlanningResource",
    "PlanningResourceCalendar",
    "PlanningScheduleEvent",
    "PlanningTask",
    "PlanningTaskParticipant",
    "PlanningTaskRequirement",
    "PlanningTaskDependency",
    "PlanningWhatIfSnapshot",
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
        "PlanningResourceCalendar": PlanningResourceCalendar.__tablename__,
        "PlanningScheduleEvent": PlanningScheduleEvent.__tablename__,
        "PlanningTask": PlanningTask.__tablename__,
        "PlanningTaskParticipant": PlanningTaskParticipant.__tablename__,
        "PlanningTaskRequirement": PlanningTaskRequirement.__tablename__,
        "PlanningTaskDependency": PlanningTaskDependency.__tablename__,
        "PlanningWhatIfSnapshot": PlanningWhatIfSnapshot.__tablename__,
    }
