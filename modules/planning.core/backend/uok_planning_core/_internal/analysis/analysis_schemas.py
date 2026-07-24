from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PlanningWhatIfTaskChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str = Field(..., min_length=1, max_length=36)
    start: str | None = Field(default=None, min_length=10, max_length=10)
    end: str | None = Field(default=None, min_length=10, max_length=10)
    progress: int | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def require_change(self) -> "PlanningWhatIfTaskChangeRequest":
        if self.start is None and self.end is None and self.progress is None:
            raise ValueError("a what-if task change must propose start, end, or progress")
        return self


class PlanningWhatIfSnapshotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    name: str = Field(default="What-if snapshot", min_length=2, max_length=120)
    task_changes: list[PlanningWhatIfTaskChangeRequest] = Field(..., min_length=1, max_length=100)


class PlanningRiskTaskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_id: str = Field(..., min_length=1, max_length=36)
    distribution: str = Field(default="triangular", pattern="^triangular$")
    minimum_days: int = Field(..., ge=1, le=3650)
    most_likely_days: int = Field(..., ge=1, le=3650)
    maximum_days: int = Field(..., ge=1, le=3650)
    correlation_group: str | None = Field(default=None, min_length=1, max_length=80)

    @model_validator(mode="after")
    def validate_order(self) -> "PlanningRiskTaskRequest":
        if not self.minimum_days <= self.most_likely_days <= self.maximum_days:
            raise ValueError("risk duration requires minimum <= most_likely <= maximum")
        return self


class PlanningRiskCorrelationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    group: str = Field(..., min_length=1, max_length=80)
    coefficient: float = Field(..., ge=0, le=.95)


class PlanningRiskAnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    snapshot_id: str = Field(..., min_length=1, max_length=36)
    seed: int = Field(..., ge=0, le=9_223_372_036_854_775_807)
    iterations: int = Field(default=1000, ge=100, le=5000)
    task_risks: list[PlanningRiskTaskRequest] = Field(..., min_length=1, max_length=200)
    correlations: list[PlanningRiskCorrelationRequest] = Field(default_factory=list, max_length=50)


class PlanningOptimizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    snapshot_id: str = Field(..., min_length=1, max_length=36)
    objective: str = Field(default="minimize_project_finish", pattern="^minimize_project_finish$")
    timeout_ms: int = Field(default=500, ge=1, le=2000)
    max_candidates: int = Field(default=50, ge=1, le=100)


class PlanningRecommendationDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)
    decision: str = Field(..., pattern="^(approve|reject)$")
    reason: str = Field(..., min_length=1, max_length=500)


class PlanningRecommendationMutationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=1)


__all__ = [
    "PlanningOptimizationRequest", "PlanningRecommendationDecisionRequest", "PlanningRecommendationMutationRequest",
    "PlanningRiskAnalysisRequest", "PlanningRiskCorrelationRequest", "PlanningRiskTaskRequest",
    "PlanningWhatIfSnapshotRequest", "PlanningWhatIfTaskChangeRequest",
]
