from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator

from uok_planning_core._internal.scheduling.advanced_commands import _ignored_periods, _working_days
from uok_planning_core._internal.scheduling.scheduler import parse_planning_date


class PlanningCalendarFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(default="Standard", min_length=1, max_length=120)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5], min_length=1, max_length=7)
    holidays: list[str] = Field(default_factory=list, max_length=3660)
    ignored_periods: list[str] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_calendar_definition(self) -> "PlanningCalendarFields":
        _working_days(self.working_days)
        for value in self.holidays:
            parse_planning_date(value, "holiday")
        _ignored_periods(self.ignored_periods)
        return self


__all__ = ["PlanningCalendarFields"]
