from __future__ import annotations

from hashlib import sha256

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import dumps

from agent_test_support import create_runbook, install_agents, start_run, submit_command_plan, unique


def test_governed_command_plan_requires_human_approval_and_retains_hash_evidence(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    finance = auth(client, "finance", "finance123")
    install_agents(client, admin)

    created = create_runbook(client, ops, name=unique("Product proposal agent"))
    assert created.status_code == 200, created.text
    runbook = created.json()["result"]
    started = start_run(client, ops, runbook["id"])
    assert started.status_code == 200, started.text
    run = started.json()["result"]

    plan = submit_command_plan(client, ops, run["id"], run["version"])
    assert plan.status_code == 200, plan.text
    planned = plan.json()["result"]
    assert planned["status"] == "awaiting_approval"
    assert "protected impact" in planned["approval_reason"]
    assert "business command" in planned["approval_reason"]
    assert len(planned["plan_sha256"]) == 64

    premature = command(client, ops, "CompleteAgentRun", {
        "run_id": run["id"],
        "expected_version": planned["version"],
        "outcome_summary": "Must not complete",
    }, unique("agent-premature-complete"))
    assert premature.status_code == 400, premature.text
    assert "must be approved" in premature.text
    denied = command(client, viewer, "DecideAgentRun", {
        "run_id": run["id"],
        "expected_version": planned["version"],
        "decision": "approve",
        "reason": "Viewer must not approve",
    }, unique("agent-viewer-approve"))
    assert denied.status_code == 403, denied.text

    queue = client.get("/api/agents/approval-queue", headers=ops)
    assert queue.status_code == 200, queue.text
    assert run["id"] in {row["id"] for row in queue.json()}
    approved = command(client, ops, "DecideAgentRun", {
        "run_id": run["id"],
        "expected_version": planned["version"],
        "decision": "approve",
        "reason": "Reviewed against Product Master policy and scope",
    }, unique("agent-approve"))
    assert approved.status_code == 200, approved.text
    approved_run = approved.json()["result"]
    assert approved_run["status"] == "approved"

    completed = command(client, ops, "CompleteAgentRun", {
        "run_id": run["id"],
        "expected_version": approved_run["version"],
        "outcome_summary": "Proposal reviewed; no direct business command executed",
        "outcome": {"executed": False},
    }, unique("agent-complete"))
    assert completed.status_code == 200, completed.text
    assert completed.json()["result"]["status"] == "completed"

    evidence = client.get(f"/api/agents/runs/{run['id']}/evidence", headers=finance)
    assert evidence.status_code == 200, evidence.text
    assert [row["evidence_type"] for row in evidence.json()] == ["input", "plan", "decision", "outcome"]
    for row in evidence.json():
        assert row["content_sha256"] == sha256(dumps(row["content"]).encode("utf-8")).hexdigest()
    assert client.get(f"/api/agents/runs/{run['id']}/evidence", headers=viewer).status_code == 403

    products = client.get("/api/products/definitions", headers=admin)
    assert products.status_code == 200, products.text
    assert products.json() == []

    with SessionLocal() as db:
        events = db.scalars(select(EventRecord).where(
            EventRecord.object_type == "AgentRun",
            EventRecord.object_id == run["id"],
        )).all()
    assert {event.event_type for event in events} == {
        "AgentRunStarted", "AgentPlanSubmitted", "AgentRunDecisionRecorded", "AgentRunCompleted"
    }
