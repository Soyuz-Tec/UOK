from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from uok_planning_core._internal.delivery.calendar_schemas import PlanningCalendarFields
from uok_planning_core._internal.delivery.schemas import PlanningLinkTargetRequest


class _StrictBatchPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PlanningBatchUpdateTaskPayload(_StrictBatchPayload):
    task_id: str = Field(..., min_length=1, max_length=36)
    title: str | None = Field(default=None, min_length=2, max_length=180)
    start: str | None = Field(default=None, min_length=10, max_length=32)
    end: str | None = Field(default=None, min_length=10, max_length=32)
    task_type: Literal["task", "summary", "milestone"] | None = None
    parent_task_id: str | None = Field(default=None, max_length=36)
    status: Literal["planned", "in_progress", "blocked", "complete"] | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    sort_order: int | None = Field(default=None, ge=0)
    cascade: bool | None = None
    scheduling_mode: Literal["auto", "manual"] | None = None
    constraint_type: str | None = Field(default=None, max_length=40)
    constraint_date: str | None = Field(default=None, min_length=10, max_length=32)


class PlanningBatchCreateDependencyPayload(_StrictBatchPayload):
    predecessor_task_id: str = Field(..., min_length=1, max_length=36)
    successor_task_id: str = Field(..., min_length=1, max_length=36)
    dependency_type: Literal["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"] = "finish_to_start"
    lag_days: int = Field(default=0, ge=-30, le=30)


class PlanningBatchUpdateDependencyPayload(_StrictBatchPayload):
    dependency_id: str = Field(..., min_length=1, max_length=36)
    dependency_type: Literal["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"] | None = None
    lag_days: int | None = Field(default=None, ge=-30, le=30)

    @model_validator(mode="after")
    def require_change(self) -> "PlanningBatchUpdateDependencyPayload":
        if self.dependency_type is None and self.lag_days is None:
            raise ValueError("update_dependency requires dependency_type or lag_days")
        return self


class PlanningBatchDependencyIdPayload(_StrictBatchPayload):
    dependency_id: str = Field(..., min_length=1, max_length=36)


class PlanningBatchAssignResourcePayload(_StrictBatchPayload):
    task_id: str = Field(..., min_length=1, max_length=36)
    resource_id: str = Field(..., min_length=1, max_length=36)
    allocation_percent: int = Field(default=100, ge=1, le=300)


class PlanningBatchUnassignResourcePayload(_StrictBatchPayload):
    assignment_id: str | None = Field(default=None, min_length=1, max_length=36)
    task_id: str | None = Field(default=None, min_length=1, max_length=36)
    resource_id: str | None = Field(default=None, min_length=1, max_length=36)

    @model_validator(mode="after")
    def require_identity(self) -> "PlanningBatchUnassignResourcePayload":
        if self.assignment_id and (self.task_id or self.resource_id):
            raise ValueError("Use assignment_id or task_id with resource_id, not both forms")
        if not self.assignment_id and not (self.task_id and self.resource_id):
            raise ValueError("unassign_resource requires assignment_id or task_id with resource_id")
        return self


class PlanningBatchCreateLinkPayload(_StrictBatchPayload):
    scope_type: Literal["project", "task"]
    task_id: str | None = Field(default=None, min_length=1, max_length=36)
    relationship: Literal["implements", "blocks_on", "requires", "proves", "owned_by", "moves", "occurs_at", "discussed_in", "publishes_to"]
    blocking: bool = False
    target: PlanningLinkTargetRequest

    @model_validator(mode="after")
    def validate_scope(self) -> "PlanningBatchCreateLinkPayload":
        if self.scope_type == "task" and not self.task_id:
            raise ValueError("task_id is required for task links")
        if self.scope_type == "project" and self.task_id:
            raise ValueError("task_id must be omitted for project links")
        return self


class PlanningBatchRemoveLinkPayload(_StrictBatchPayload):
    link_id: str = Field(..., min_length=1, max_length=36)


class PlanningBatchTransitionGatePayload(_StrictBatchPayload):
    task_id: str = Field(..., min_length=1, max_length=36)
    requirement_id: str = Field(..., min_length=1, max_length=36)
    action: Literal["submit", "start_review", "satisfy", "reject", "waive"]
    reason: str | None = Field(default=None, min_length=1, max_length=500)

    @model_validator(mode="after")
    def require_decision_reason(self) -> "PlanningBatchTransitionGatePayload":
        if self.action in {"satisfy", "reject", "waive"} and not self.reason:
            raise ValueError("reason is required for a gate decision")
        if self.action in {"submit", "start_review"} and self.reason:
            raise ValueError("reason is only accepted for a gate decision")
        return self


class _BatchOperation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operation_id: str = Field(..., min_length=1, max_length=80)


class PlanningBatchUpdateTaskOperation(_BatchOperation):
    kind: Literal["update_task"]
    payload: PlanningBatchUpdateTaskPayload


class PlanningBatchCreateDependencyOperation(_BatchOperation):
    kind: Literal["create_dependency"]
    payload: PlanningBatchCreateDependencyPayload


class PlanningBatchUpdateDependencyOperation(_BatchOperation):
    kind: Literal["update_dependency"]
    payload: PlanningBatchUpdateDependencyPayload


class PlanningBatchRemoveDependencyOperation(_BatchOperation):
    kind: Literal["remove_dependency"]
    payload: PlanningBatchDependencyIdPayload


class PlanningBatchAssignResourceOperation(_BatchOperation):
    kind: Literal["assign_resource"]
    payload: PlanningBatchAssignResourcePayload


class PlanningBatchUnassignResourceOperation(_BatchOperation):
    kind: Literal["unassign_resource"]
    payload: PlanningBatchUnassignResourcePayload


class PlanningBatchSetCalendarOperation(_BatchOperation):
    kind: Literal["set_calendar"]
    payload: PlanningCalendarFields


class PlanningBatchCreateLinkOperation(_BatchOperation):
    kind: Literal["create_link"]
    payload: PlanningBatchCreateLinkPayload


class PlanningBatchRemoveLinkOperation(_BatchOperation):
    kind: Literal["remove_link"]
    payload: PlanningBatchRemoveLinkPayload


class PlanningBatchTransitionGateOperation(_BatchOperation):
    kind: Literal["transition_gate"]
    payload: PlanningBatchTransitionGatePayload


PlanningBatchOperation = Annotated[
    PlanningBatchUpdateTaskOperation
    | PlanningBatchCreateDependencyOperation
    | PlanningBatchUpdateDependencyOperation
    | PlanningBatchRemoveDependencyOperation
    | PlanningBatchAssignResourceOperation
    | PlanningBatchUnassignResourceOperation
    | PlanningBatchSetCalendarOperation
    | PlanningBatchCreateLinkOperation
    | PlanningBatchRemoveLinkOperation
    | PlanningBatchTransitionGateOperation,
    Field(discriminator="kind"),
]


class PlanningBatchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    reason: str | None = Field(default=None, max_length=500)
    source_command_id: str | None = Field(default=None, min_length=36, max_length=36)
    operations: list[PlanningBatchOperation] = Field(..., min_length=1, max_length=500)


__all__ = ["PlanningBatchOperation", "PlanningBatchRequest"]
