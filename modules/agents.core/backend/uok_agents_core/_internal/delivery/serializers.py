from __future__ import annotations

from typing import Any

from uok.util import loads

from uok_agents_core._internal.persistence.models import AgentApproval, AgentEvidence, AgentRun, AgentRunbook


def runbook_response(row: AgentRunbook, correlation_id: str | None = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "description": row.description,
        "goal": row.goal,
        "target_module": row.target_module,
        "allowed_tools": loads(row.allowed_tools_json, []),
        "allowed_commands": loads(row.allowed_commands_json, []),
        "allowed_data_scopes": loads(row.allowed_data_scopes_json, []),
        "risk_level": row.risk_level,
        "approval_policy": row.approval_policy,
        "status": row.status,
        "version": row.version,
        "created_by_user_id": row.created_by_user_id,
        "updated_by_user_id": row.updated_by_user_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "archived_at": row.archived_at,
        "correlation_id": correlation_id,
    }


def run_response(row: AgentRun, correlation_id: str | None = None) -> dict[str, Any]:
    return {
        "id": row.id,
        "runbook_id": row.runbook_id,
        "runbook_version": row.runbook_version,
        "target_module": row.target_module,
        "risk_level": row.risk_level,
        "approval_policy": row.approval_policy,
        "allowed_tools": loads(row.allowed_tools_json, []),
        "allowed_commands": loads(row.allowed_commands_json, []),
        "allowed_data_scopes": loads(row.allowed_data_scopes_json, []),
        "input_context": loads(row.input_json, {}),
        "plan_kind": row.plan_kind,
        "plan": loads(row.plan_json, {}),
        "plan_sha256": row.plan_sha256,
        "status": row.status,
        "approval_reason": row.approval_reason,
        "version": row.version,
        "requested_by_user_id": row.requested_by_user_id,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
        "decided_at": row.decided_at,
        "completed_at": row.completed_at,
        "correlation_id": correlation_id,
    }


def approval_response(row: AgentApproval) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "decision": row.decision,
        "reason": row.reason,
        "decided_by_user_id": row.decided_by_user_id,
        "decided_at": row.decided_at,
    }


def evidence_response(row: AgentEvidence) -> dict[str, Any]:
    return {
        "id": row.id,
        "run_id": row.run_id,
        "evidence_type": row.evidence_type,
        "summary": row.summary,
        "content": loads(row.content_json, {}),
        "content_sha256": row.content_sha256,
        "recorded_by_user_id": row.recorded_by_user_id,
        "created_at": row.created_at,
    }


__all__ = ["approval_response", "evidence_response", "run_response", "runbook_response"]
