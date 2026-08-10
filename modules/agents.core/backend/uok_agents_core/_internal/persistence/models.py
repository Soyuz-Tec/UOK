from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from uok.kernel.persistence import Base
from uok.models_base import new_id, utcnow


class AgentRunbook(Base):
    __tablename__ = "agent_runbooks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal: Mapped[str] = mapped_column(Text)
    target_module: Mapped[str] = mapped_column(String(120))
    allowed_tools_json: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    allowed_commands_json: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    allowed_data_scopes_json: Mapped[str] = mapped_column(Text, default="[]", server_default="[]")
    risk_level: Mapped[str] = mapped_column(String(20))
    approval_policy: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    created_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    updated_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_agent_runbooks_org_name"),
        CheckConstraint("risk_level IN ('low', 'medium', 'high', 'critical')", name="ck_agent_runbooks_risk"),
        CheckConstraint("approval_policy IN ('always', 'risk_based')", name="ck_agent_runbooks_approval"),
        CheckConstraint("status IN ('active', 'archived')", name="ck_agent_runbooks_status"),
        CheckConstraint("version >= 1", name="ck_agent_runbooks_version"),
        Index("ix_agent_runbooks_org_status_name", "organization_id", "status", "name"),
    )


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    runbook_id: Mapped[str] = mapped_column(ForeignKey("agent_runbooks.id"), index=True)
    runbook_version: Mapped[int] = mapped_column(BigInteger)
    target_module: Mapped[str] = mapped_column(String(120))
    risk_level: Mapped[str] = mapped_column(String(20))
    approval_policy: Mapped[str] = mapped_column(String(20))
    allowed_tools_json: Mapped[str] = mapped_column(Text)
    allowed_commands_json: Mapped[str] = mapped_column(Text)
    allowed_data_scopes_json: Mapped[str] = mapped_column(Text)
    input_json: Mapped[str] = mapped_column(Text, default="{}", server_default="{}")
    plan_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)
    plan_json: Mapped[str] = mapped_column(Text, default="{}", server_default="{}")
    plan_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="draft", server_default="draft")
    approval_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    version: Mapped[int] = mapped_column(BigInteger, default=1, server_default="1")
    requested_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("risk_level IN ('low', 'medium', 'high', 'critical')", name="ck_agent_runs_risk"),
        CheckConstraint("approval_policy IN ('always', 'risk_based')", name="ck_agent_runs_approval"),
        CheckConstraint(
            "status IN ('draft', 'awaiting_approval', 'approved', 'revision_requested', "
            "'rejected', 'escalated', 'completed', 'failed')",
            name="ck_agent_runs_status",
        ),
        CheckConstraint("version >= 1", name="ck_agent_runs_version"),
        Index("ix_agent_runs_org_status_created", "organization_id", "status", "created_at"),
        Index("ix_agent_runs_org_runbook_created", "organization_id", "runbook_id", "created_at"),
    )


class AgentApproval(Base):
    __tablename__ = "agent_approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True)
    decision: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(Text)
    decided_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint(
            "decision IN ('approved', 'rejected', 'revision_requested', 'escalated', 'overridden')",
            name="ck_agent_approvals_decision",
        ),
        Index("ix_agent_approvals_org_run_decided", "organization_id", "run_id", "decided_at"),
    )


class AgentEvidence(Base):
    __tablename__ = "agent_evidence"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("agent_runs.id"), index=True)
    evidence_type: Mapped[str] = mapped_column(String(32))
    summary: Mapped[str] = mapped_column(String(500))
    content_json: Mapped[str] = mapped_column(Text)
    content_sha256: Mapped[str] = mapped_column(String(64))
    recorded_by_user_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        CheckConstraint(
            "evidence_type IN ('input', 'plan', 'decision', 'override', 'outcome', 'failure')",
            name="ck_agent_evidence_type",
        ),
        Index("ix_agent_evidence_org_run_created", "organization_id", "run_id", "created_at"),
    )


def owned_models() -> dict[str, type]:
    return {
        "AgentRunbook": AgentRunbook,
        "AgentRun": AgentRun,
        "AgentApproval": AgentApproval,
        "AgentEvidence": AgentEvidence,
    }


__all__ = ["AgentApproval", "AgentEvidence", "AgentRun", "AgentRunbook", "owned_models"]
