from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class AgentRunbookResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    name: str
    description: str | None
    goal: str
    target_module: str
    allowed_tools: list[str]
    allowed_commands: list[str]
    allowed_data_scopes: list[str]
    risk_level: str
    approval_policy: str
    status: str
    version: int
    created_by_user_id: str
    updated_by_user_id: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None
    correlation_id: str | None = None


class AgentRunResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    runbook_id: str
    runbook_version: int
    target_module: str
    risk_level: str
    approval_policy: str
    allowed_tools: list[str]
    allowed_commands: list[str]
    allowed_data_scopes: list[str]
    input_context: dict[str, Any]
    plan_kind: str | None
    plan: dict[str, Any]
    plan_sha256: str | None
    status: str
    approval_reason: str | None
    version: int
    requested_by_user_id: str
    created_at: datetime
    updated_at: datetime
    decided_at: datetime | None
    completed_at: datetime | None
    correlation_id: str | None = None


class AgentApprovalResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    run_id: str
    decision: str
    reason: str
    decided_by_user_id: str
    decided_at: datetime


class AgentEvidenceResponse(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    run_id: str
    evidence_type: str
    summary: str
    content: dict[str, Any]
    content_sha256: str
    recorded_by_user_id: str
    created_at: datetime


__all__ = [
    "AgentApprovalResponse",
    "AgentEvidenceResponse",
    "AgentRunResponse",
    "AgentRunbookResponse",
]
