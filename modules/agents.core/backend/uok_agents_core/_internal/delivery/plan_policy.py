from __future__ import annotations

from collections.abc import Iterable

from uok.util import dumps, loads

from uok_agents_core._internal.persistence.models import AgentRun

from .request_schemas import AgentPlanStep, AgentPlanSubmitRequest


SUPPORTED_TOOL_BINDINGS = frozenset({"codex"})
PROTECTED_IMPACTS = frozenset({
    "internal_update",
    "external_submission",
    "financial_commitment",
    "record_purge",
    "legal_acceptance",
    "policy_exception",
})
MAX_PLAN_BYTES = 64 * 1024


def validate_plan(run: AgentRun, request: AgentPlanSubmitRequest) -> tuple[dict[str, object], str | None]:
    _validate_plan_kind(run.status, request.plan_kind)
    _validate_step_graph(request.steps)
    _validate_step_scope(run, request.steps)
    plan = request.model_dump(mode="json", exclude={"run_id", "expected_version"})
    if len(dumps(plan).encode("utf-8")) > MAX_PLAN_BYTES:
        raise ValueError("agent plan exceeds the 64 KiB evidence limit")
    return plan, approval_reason(run, request.steps)


def approval_reason(run: AgentRun, steps: Iterable[AgentPlanStep]) -> str | None:
    reasons: list[str] = []
    if run.approval_policy == "always":
        reasons.append("runbook policy requires human approval")
    if run.risk_level != "low":
        reasons.append(f"runbook risk is {run.risk_level}")
    protected = sorted({step.impact for step in steps if step.impact in PROTECTED_IMPACTS})
    if protected:
        reasons.append(f"plan includes protected impact: {', '.join(protected)}")
    if any(step.kind == "command" for step in steps):
        reasons.append("plan proposes a business command")
    return "; ".join(reasons) if reasons else None


def _validate_plan_kind(status: str, plan_kind: str) -> None:
    expected = {
        "initial": "draft",
        "revision": "revision_requested",
        "recovery": "failed",
    }[plan_kind]
    if status != expected:
        raise ValueError(f"{plan_kind} plan requires run status {expected}; current status is {status}")


def _validate_step_scope(run: AgentRun, steps: Iterable[AgentPlanStep]) -> None:
    allowed_tools = set(loads(run.allowed_tools_json, []))
    allowed_commands = set(loads(run.allowed_commands_json, []))
    allowed_scopes = set(loads(run.allowed_data_scopes_json, []))
    for step in steps:
        if step.target_module and step.target_module != run.target_module:
            raise ValueError(f"step {step.step_id} targets undeclared module {step.target_module}")
        if step.tool and step.tool not in allowed_tools:
            raise ValueError(f"step {step.step_id} uses undeclared tool {step.tool}")
        if step.command and step.command not in allowed_commands:
            raise ValueError(f"step {step.step_id} uses undeclared command {step.command}")
        undeclared_scopes = sorted(set(step.data_scopes) - allowed_scopes)
        if undeclared_scopes:
            raise ValueError(
                f"step {step.step_id} uses undeclared data scopes: {', '.join(undeclared_scopes)}"
            )


def _validate_step_graph(steps: list[AgentPlanStep]) -> None:
    by_id = {step.step_id: step for step in steps}
    if len(by_id) != len(steps):
        raise ValueError("agent plan contains duplicate step_id values")
    for step in steps:
        missing = sorted(set(step.depends_on) - set(by_id))
        if missing:
            raise ValueError(f"step {step.step_id} depends on unknown steps: {', '.join(missing)}")
    visited: set[str] = set()
    visiting: set[str] = set()

    def visit(step_id: str) -> None:
        if step_id in visiting:
            raise ValueError("agent plan dependency graph contains a cycle")
        if step_id in visited:
            return
        visiting.add(step_id)
        for dependency in by_id[step_id].depends_on:
            visit(dependency)
        visiting.remove(step_id)
        visited.add(step_id)

    for step_id in by_id:
        visit(step_id)


__all__ = ["PROTECTED_IMPACTS", "SUPPORTED_TOOL_BINDINGS", "approval_reason", "validate_plan"]
