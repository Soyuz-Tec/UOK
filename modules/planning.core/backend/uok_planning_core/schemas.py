from __future__ import annotations

from pydantic import BaseModel, Field


class PlanningProjectRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=180)
    start: str = Field(..., min_length=10, max_length=32)
    end: str = Field(..., min_length=10, max_length=32)


class PlanningTaskRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=180)
    start: str = Field(..., min_length=10, max_length=32)
    end: str = Field(..., min_length=10, max_length=32)
    task_type: str = Field(default="task", pattern="^(task|summary|milestone)$")
    status: str = Field(default="planned", max_length=40)
    progress: int = Field(default=0, ge=0, le=100)
    parent_task_id: str | None = Field(default=None, max_length=36)
    sort_order: int = Field(default=0, ge=0)


class PlanningTaskUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=180)
    start: str | None = Field(default=None, min_length=10, max_length=32)
    end: str | None = Field(default=None, min_length=10, max_length=32)
    status: str | None = Field(default=None, max_length=40)
    progress: int | None = Field(default=None, ge=0, le=100)
    sort_order: int | None = Field(default=None, ge=0)


class PlanningDependencyRequest(BaseModel):
    predecessor_task_id: str = Field(..., max_length=36)
    successor_task_id: str = Field(..., max_length=36)
    dependency_type: str = Field(default="finish_to_start", pattern="^finish_to_start$")
    lag_days: int = Field(default=0, ge=0, le=30)
