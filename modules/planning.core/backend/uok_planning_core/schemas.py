from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class PlanningProjectRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    start: str = Field(..., min_length=10, max_length=32)
    end: str = Field(..., min_length=10, max_length=32)
    timezone: str = Field(default="UTC", min_length=1, max_length=80)


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


class PlanningCalendarRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(default="Standard", max_length=120)
    working_days: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5])
    holidays: list[str] = Field(default_factory=list)
    ignored_periods: list[str] = Field(default_factory=list)


class PlanningBaselineRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(default="Baseline", min_length=2, max_length=120)


class PlanningResourceRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(..., min_length=2, max_length=160)
    role: str = Field(default="", max_length=120)


class PlanningAssignmentRequest(BaseModel):
    expected_revision: int | None = Field(default=None, ge=1)
    task_id: str = Field(..., max_length=36)
    resource_id: str = Field(..., max_length=36)
    allocation_percent: int = Field(default=100, ge=1, le=300)


class PlanningBatchOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: str = Field(..., min_length=1, max_length=80)
    kind: str = Field(..., min_length=1, max_length=80, pattern="^[a-z_]+$")
    payload: dict[str, Any]


class PlanningBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    reason: str | None = Field(default=None, max_length=500)
    source_command_id: str | None = Field(default=None, min_length=36, max_length=36)
    operations: list[PlanningBatchOperation] = Field(..., min_length=1, max_length=500)


class PlanningLinkTargetRequest(BaseModel):
    model_config = {"extra": "forbid"}

    kind: str = Field(..., pattern="^(operation|gate|evidence|party|shipment|document|location|asset|agreement|communication_thread|calendar_event)$")
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
