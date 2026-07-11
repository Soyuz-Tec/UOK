"""Compatibility aliases for Planning-owned resource ORM models."""

from datetime import datetime, timezone
from uuid import uuid4

from .models import PlanningAssignment, PlanningResource, PlanningResourceCalendar


def planning_resource_id() -> str:
    return str(uuid4())


def planning_resource_now() -> datetime:
    return datetime.now(timezone.utc)


__all__ = [
    "PlanningAssignment",
    "PlanningResource",
    "PlanningResourceCalendar",
    "planning_resource_id",
    "planning_resource_now",
]
