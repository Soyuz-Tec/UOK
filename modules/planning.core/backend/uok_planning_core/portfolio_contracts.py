from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

PlanningPublicProjectStatus = Literal["draft", "active", "on_hold", "completed", "archived"]
PlanningProjectStatusFilter = Literal["", "draft", "active", "on_hold", "completed", "archived"]


class PlanningPortfolioMetrics(BaseModel):
    task_count: int
    completed_task_count: int
    in_progress_task_count: int
    blocked_task_count: int
    milestone_count: int
    dependency_count: int
    completion_percent: int = Field(ge=0, le=100)


class PlanningPortfolioAttention(BaseModel):
    health: Literal["on_track", "attention", "blocked"]
    overdue_task_count: int
    gate_blocker_count: int
    unavailable_blocking_link_count: int
    project_overdue: bool
    project_late: bool
    issue_count: int


class PlanningPortfolioProject(BaseModel):
    id: str
    name: str
    status: PlanningPublicProjectStatus
    start: str
    end: str
    target_finish: str
    calculated_finish: str
    latest_task_finish: str | None
    schedule_horizon: str
    timezone: str
    revision: int
    updated_at: str | None
    metrics: PlanningPortfolioMetrics
    attention: PlanningPortfolioAttention


class PlanningPortfolioSummary(BaseModel):
    visible_project_count: int
    total_project_count: int
    task_count: int
    completed_task_count: int
    blocked_task_count: int
    overdue_task_count: int
    gate_blocker_count: int
    at_risk_project_count: int
    status_counts: dict[str, int]
    range_start: str | None
    range_end: str | None


class PlanningPortfolioDiagnostics(BaseModel):
    strategy: Literal["bounded_aggregate_v1"]
    query_count: int = Field(ge=2, le=6)
    elapsed_ms: float = Field(ge=0)


class PlanningPortfolioResponse(BaseModel):
    total: int
    limit: int
    offset: int
    query: str
    status: PlanningProjectStatusFilter
    projects: list[PlanningPortfolioProject]
    summary: PlanningPortfolioSummary
    diagnostics: PlanningPortfolioDiagnostics
