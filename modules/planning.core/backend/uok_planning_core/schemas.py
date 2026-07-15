from __future__ import annotations

from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .calendar_schemas import PlanningCalendarFields
from .resource_contract import resource_definition
from .resource_calendar import resource_calendar_definition


PlanningTaskStatus = Literal["planned", "in_progress", "blocked", "complete"]


class PlanningTaskFlowStatus(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: PlanningTaskStatus
    display_label: str = Field(..., min_length=1, max_length=80)
    allowed_transitions: list[PlanningTaskStatus]


class PlanningTaskFlowContract(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal[1]
    statuses: list[PlanningTaskFlowStatus]


class PlanningScheduleReadModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    task_flow: PlanningTaskFlowContract


class PlanningProjectRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    start: str = Field(..., min_length=10, max_length=32)
    end: str = Field(..., min_length=10, max_length=32)
    timezone: str = Field(default="UTC", min_length=1, max_length=80)


class PlanningProjectTransitionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    target_status: Literal["draft", "active", "on_hold", "completed", "archived"]
    reason: str = Field(..., min_length=1, max_length=500)


class PlanningTaskRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    title: str = Field(..., min_length=2, max_length=180)
    start: str = Field(..., min_length=10, max_length=32)
    end: str = Field(..., min_length=10, max_length=32)
    task_type: str = Field(default="task", pattern="^(task|summary|milestone)$")
    status: str = Field(default="planned", pattern="^(planned|in_progress|blocked|complete)$")
    progress: int = Field(default=0, ge=0, le=100)
    parent_task_id: str | None = Field(default=None, max_length=36)
    sort_order: int = Field(default=0, ge=0)
    scheduling_mode: str = Field(default="auto", pattern="^(auto|manual)$")
    constraint_type: str | None = Field(default=None, max_length=40)
    constraint_date: str | None = Field(default=None, min_length=10, max_length=32)


class PlanningTaskUpdateRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    title: str | None = Field(default=None, min_length=2, max_length=180)
    start: str | None = Field(default=None, min_length=10, max_length=32)
    end: str | None = Field(default=None, min_length=10, max_length=32)
    task_type: str | None = Field(default=None, pattern="^(task|summary|milestone)$")
    parent_task_id: str | None = Field(default=None, max_length=36)
    status: str | None = Field(default=None, pattern="^(planned|in_progress|blocked|complete)$")
    progress: int | None = Field(default=None, ge=0, le=100)
    sort_order: int | None = Field(default=None, ge=0)
    cascade: bool | None = Field(default=None)
    scheduling_mode: str | None = Field(default=None, pattern="^(auto|manual)$")
    constraint_type: str | None = Field(default=None, max_length=40)
    constraint_date: str | None = Field(default=None, min_length=10, max_length=32)


class PlanningTaskDateUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    forecast_start: str | None = Field(default=None, min_length=10, max_length=10)
    forecast_end: str | None = Field(default=None, min_length=10, max_length=10)
    actual_start: str | None = Field(default=None, min_length=10, max_length=10)
    actual_end: str | None = Field(default=None, min_length=10, max_length=10)
    deadline: str | None = Field(default=None, min_length=10, max_length=10)
    reason: str | None = Field(default=None, max_length=500)


class PlanningDependencyRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    predecessor_task_id: str = Field(..., max_length=36)
    successor_task_id: str = Field(..., max_length=36)
    dependency_type: str = Field(default="finish_to_start", pattern="^(finish_to_start|start_to_start|finish_to_finish|start_to_finish)$")
    lag_days: int = Field(default=0, ge=-30, le=30)


class PlanningDependencyUpdateRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    dependency_type: str | None = Field(default=None, pattern="^(finish_to_start|start_to_start|finish_to_finish|start_to_finish)$")
    lag_days: int | None = Field(default=None, ge=-30, le=30)


class PlanningCalendarRequest(PlanningCalendarFields):
    expected_revision: int | None = Field(default=None, ge=1)


class PlanningBaselineRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(default="Baseline", min_length=2, max_length=120)


class PlanningResourceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(..., min_length=2, max_length=160)
    role: str = Field(default="", max_length=120)
    resource_type: str = Field(default="human", pattern="^(human|team|vehicle|equipment|material|budget|time_window|document|location|asset|custom)$")
    capacity_value: Decimal = Field(default=Decimal("1"), gt=0, max_digits=14, decimal_places=3)
    capacity_unit: str | None = Field(default=None, max_length=40)
    canonical_target_kind: str | None = Field(default=None, max_length=40)
    canonical_target_id: str | None = Field(default=None, min_length=1, max_length=180)
    effective_start: str | None = Field(default=None, min_length=10, max_length=10)
    effective_end: str | None = Field(default=None, min_length=10, max_length=10)

    @model_validator(mode="after")
    def validate_resource_contract(self) -> "PlanningResourceRequest":
        resource_definition(self.model_dump(exclude={"expected_revision"}))
        return self


class PlanningResourceCapacityExceptionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start: str = Field(..., min_length=10, max_length=10)
    end: str = Field(..., min_length=10, max_length=10)
    capacity_percent: int = Field(..., ge=0, le=300)
    reason: str = Field(default="", max_length=180)


class PlanningResourceCalendarRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(default="Resource capacity", min_length=1, max_length=120)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5], min_length=1, max_length=7)
    holidays: list[str] = Field(default_factory=list, max_length=3660)
    default_capacity_percent: int = Field(default=100, ge=0, le=300)
    capacity_exceptions: list[PlanningResourceCapacityExceptionRequest] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_resource_calendar_contract(self) -> "PlanningResourceCalendarRequest":
        resource_calendar_definition(self.model_dump(exclude={"expected_revision"}))
        return self


class PlanningAssignmentRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    task_id: str = Field(..., max_length=36)
    resource_id: str = Field(..., max_length=36)
    allocation_percent: int = Field(default=100, ge=1, le=300)


class PlanningLinkTargetRequest(BaseModel):
    model_config = {"extra": "forbid"}

    kind: Literal["operation", "gate", "evidence", "party", "shipment", "document", "location", "asset", "agreement", "communication_thread", "calendar_event"]
    id: str = Field(..., min_length=1, max_length=180)


class PlanningLinkRequest(BaseModel):
    model_config = {"extra": "forbid"}

    expected_revision: int | None = Field(default=None, ge=1)
    scope_type: str = Field(..., pattern="^(project|task)$")
    task_id: str | None = Field(default=None, min_length=1, max_length=36)
    relationship: str = Field(..., pattern="^(implements|blocks_on|requires|proves|owned_by|moves|occurs_at|discussed_in|publishes_to)$")
    blocking: bool = False
    target: PlanningLinkTargetRequest


class PlanningTaskParticipantRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    party_id: str = Field(..., min_length=1, max_length=36)
    role: str = Field(..., pattern="^(owner|assignee|approver|consulted|informed|external_contact)$")


class PlanningTaskRequirementRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    requirement_type: str = Field(..., pattern="^(evidence|approval|compliance|finance|shipment|document|custom)$")
    title: str = Field(..., min_length=2, max_length=180)
    required: bool = True
    target_link_id: str | None = Field(default=None, min_length=1, max_length=36)
    due: str | None = Field(default=None, min_length=10, max_length=10)


class PlanningTaskRequirementAdvanceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    action: str = Field(..., pattern="^(submit|start_review)$")


class PlanningTaskRequirementLinkRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    target_link_id: str | None = Field(..., min_length=1, max_length=36)


class PlanningTaskRequirementDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    decision: str = Field(..., pattern="^(satisfy|reject|waive)$")
    reason: str = Field(..., min_length=1, max_length=500)
