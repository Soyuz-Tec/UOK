from __future__ import annotations

from uok.models_base import utcnow

from .planning_analysis_models import (
    PlanningAnalysisRecommendation,
    PlanningAnalysisRun,
    PlanningWhatIfSnapshot,
)
from .planning_audit_models import PlanningOutboxEvent, PlanningScheduleRevision
from .planning_models import (
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
from .planning_resource_models import (
    PlanningAssignment,
    PlanningResource,
    PlanningResourceCalendar,
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
    "PlanningScheduleRevision",
    "PlanningOutboxEvent",
    "PlanningTask",
    "PlanningTaskParticipant",
    "PlanningTaskRequirement",
    "PlanningTaskDependency",
    "PlanningWhatIfSnapshot",
    "PlanningAnalysisRun",
    "PlanningAnalysisRecommendation",
    "owned_models",
    "utcnow",
]


def owned_models() -> dict[str, type]:
    return {
        "PlanningAssignment": PlanningAssignment,
        "PlanningBaseline": PlanningBaseline,
        "PlanningCalendar": PlanningCalendar,
        "PlanningLink": PlanningLink,
        "PlanningProject": PlanningProject,
        "PlanningResource": PlanningResource,
        "PlanningResourceCalendar": PlanningResourceCalendar,
        "PlanningScheduleEvent": PlanningScheduleEvent,
        "PlanningScheduleRevision": PlanningScheduleRevision,
        "PlanningOutboxEvent": PlanningOutboxEvent,
        "PlanningTask": PlanningTask,
        "PlanningTaskParticipant": PlanningTaskParticipant,
        "PlanningTaskRequirement": PlanningTaskRequirement,
        "PlanningTaskDependency": PlanningTaskDependency,
        "PlanningWhatIfSnapshot": PlanningWhatIfSnapshot,
        "PlanningAnalysisRun": PlanningAnalysisRun,
        "PlanningAnalysisRecommendation": PlanningAnalysisRecommendation,
    }
