from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, JsonValue, field_validator, model_validator


RiskLevel = Literal["low", "medium", "high", "critical"]
ApprovalPolicy = Literal["always", "risk_based"]
PlanKind = Literal["initial", "revision", "recovery"]
StepKind = Literal["analysis", "tool", "command", "human"]
StepImpact = Literal[
    "informational",
    "internal_update",
    "external_submission",
    "financial_commitment",
    "record_purge",
    "legal_acceptance",
    "policy_exception",
]
Decision = Literal["approve", "reject", "request_revision", "escalate"]
JsonObject = dict[str, JsonValue]

_MODULE_RE = re.compile(r"^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")
_TOOL_RE = re.compile(r"^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")
_COMMAND_RE = re.compile(r"^[A-Z][A-Za-z0-9]{1,119}$")
_SCOPE_RE = re.compile(r"^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$")
_STEP_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def _text(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError("value cannot be blank")
    return normalized


def _identifier_list(values: list[str] | None, pattern: re.Pattern[str], label: str) -> list[str] | None:
    if values is None:
        return None
    normalized = [_text(value) for value in values]
    if len(normalized) != len(set(normalized)):
        raise ValueError(f"{label} contains duplicate values")
    invalid = [value for value in normalized if not pattern.fullmatch(value)]
    if invalid:
        raise ValueError(f"{label} contains invalid values: {', '.join(invalid)}")
    return normalized


class AgentRunbookCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    goal: str = Field(..., min_length=1, max_length=4000)
    target_module: str = Field(..., min_length=1, max_length=120)
    allowed_tools: list[str] = Field(default_factory=list, max_length=20)
    allowed_commands: list[str] = Field(default_factory=list, max_length=100)
    allowed_data_scopes: list[str] = Field(default_factory=list, max_length=100)
    risk_level: RiskLevel = "medium"
    approval_policy: ApprovalPolicy = "always"

    @field_validator("name", "goal")
    @classmethod
    def normalize_required_text(cls, value: str) -> str:
        return _text(value)

    @field_validator("description")
    @classmethod
    def normalize_description(cls, value: str | None) -> str | None:
        return _text(value) if value is not None else None

    @field_validator("target_module")
    @classmethod
    def normalize_module(cls, value: str) -> str:
        normalized = _text(value)
        if not _MODULE_RE.fullmatch(normalized):
            raise ValueError("target_module must be a canonical module identifier")
        return normalized

    @field_validator("allowed_tools")
    @classmethod
    def normalize_tools(cls, values: list[str]) -> list[str]:
        return _identifier_list(values, _TOOL_RE, "allowed_tools") or []

    @field_validator("allowed_commands")
    @classmethod
    def normalize_commands(cls, values: list[str]) -> list[str]:
        return _identifier_list(values, _COMMAND_RE, "allowed_commands") or []

    @field_validator("allowed_data_scopes")
    @classmethod
    def normalize_scopes(cls, values: list[str]) -> list[str]:
        return _identifier_list(values, _SCOPE_RE, "allowed_data_scopes") or []


class AgentRunbookUpdateRequest(AgentRunbookCreateRequest):
    runbook_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)

    @field_validator("runbook_id")
    @classmethod
    def normalize_runbook_id(cls, value: str) -> str:
        return _text(value)


class AgentRunbookArchiveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runbook_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)

    @field_validator("runbook_id")
    @classmethod
    def normalize_runbook_id(cls, value: str) -> str:
        return _text(value)


class AgentRunStartRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    runbook_id: str = Field(..., min_length=1, max_length=36)
    input_context: JsonObject = Field(default_factory=dict)

    @field_validator("runbook_id")
    @classmethod
    def normalize_runbook_id(cls, value: str) -> str:
        return _text(value)


class AgentPlanStep(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step_id: str = Field(..., min_length=1, max_length=64)
    kind: StepKind
    title: str = Field(..., min_length=1, max_length=200)
    instructions: str = Field(..., min_length=1, max_length=2000)
    impact: StepImpact = "informational"
    target_module: str | None = Field(default=None, max_length=120)
    tool: str | None = Field(default=None, max_length=120)
    command: str | None = Field(default=None, max_length=120)
    data_scopes: list[str] = Field(default_factory=list, max_length=100)
    depends_on: list[str] = Field(default_factory=list, max_length=50)

    @field_validator("step_id")
    @classmethod
    def normalize_step_id(cls, value: str) -> str:
        normalized = _text(value)
        if not _STEP_ID_RE.fullmatch(normalized):
            raise ValueError("step_id must use letters, numbers, dots, hyphens, or underscores")
        return normalized

    @field_validator("title", "instructions")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)

    @field_validator("target_module", "tool", "command")
    @classmethod
    def normalize_optional_identifier(cls, value: str | None) -> str | None:
        return _text(value) if value is not None else None

    @field_validator("data_scopes")
    @classmethod
    def normalize_scopes(cls, values: list[str]) -> list[str]:
        return _identifier_list(values, _SCOPE_RE, "data_scopes") or []

    @field_validator("depends_on")
    @classmethod
    def normalize_dependencies(cls, values: list[str]) -> list[str]:
        normalized = [_text(value) for value in values]
        if len(normalized) != len(set(normalized)):
            raise ValueError("depends_on contains duplicate values")
        if any(not _STEP_ID_RE.fullmatch(value) for value in normalized):
            raise ValueError("depends_on contains an invalid step identifier")
        return normalized

    @model_validator(mode="after")
    def validate_kind_contract(self) -> "AgentPlanStep":
        if self.kind == "tool" and not self.tool:
            raise ValueError("tool steps require tool")
        if self.kind == "command" and (not self.command or not self.target_module):
            raise ValueError("command steps require command and target_module")
        if self.kind in {"analysis", "human"} and (self.tool or self.command):
            raise ValueError(f"{self.kind} steps cannot declare tool or command")
        if self.kind != "command" and self.command:
            raise ValueError("only command steps may declare command")
        if self.kind != "tool" and self.tool:
            raise ValueError("only tool steps may declare tool")
        if self.kind == "command" and self.impact == "informational":
            raise ValueError("command steps must declare a mutating impact")
        if self.step_id in self.depends_on:
            raise ValueError("a plan step cannot depend on itself")
        return self


class AgentPlanSubmitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    plan_kind: PlanKind = "initial"
    summary: str = Field(..., min_length=1, max_length=500)
    steps: list[AgentPlanStep] = Field(..., min_length=1, max_length=100)

    @field_validator("run_id", "summary")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)


class AgentDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    decision: Decision
    reason: str = Field(..., min_length=3, max_length=2000)

    @field_validator("run_id", "reason")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)


class AgentOverrideRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    reason: str = Field(..., min_length=10, max_length=2000)

    @field_validator("run_id", "reason")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)


class AgentRunCompleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    outcome_summary: str = Field(..., min_length=3, max_length=500)
    outcome: JsonObject = Field(default_factory=dict)

    @field_validator("run_id", "outcome_summary")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)


class AgentRunFailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(..., min_length=1, max_length=36)
    expected_version: int = Field(..., ge=1)
    reason: str = Field(..., min_length=3, max_length=500)
    failure_context: JsonObject = Field(default_factory=dict)

    @field_validator("run_id", "reason")
    @classmethod
    def normalize_text(cls, value: str) -> str:
        return _text(value)


__all__ = [
    "AgentDecisionRequest",
    "AgentOverrideRequest",
    "AgentPlanStep",
    "AgentPlanSubmitRequest",
    "AgentRunCompleteRequest",
    "AgentRunFailRequest",
    "AgentRunStartRequest",
    "AgentRunbookArchiveRequest",
    "AgentRunbookCreateRequest",
    "AgentRunbookUpdateRequest",
]
