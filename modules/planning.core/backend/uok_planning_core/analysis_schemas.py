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


__all__ = ["PlanningWhatIfSnapshotRequest", "PlanningWhatIfTaskChangeRequest"]
