from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User

from agent_test_support import create_runbook, install_agents, start_run, unique


def test_agent_runbooks_runs_and_evidence_are_tenant_scoped(client: TestClient) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_agents(client, admin)
    other = _other_tenant_headers()
    install_agents(client, other)

    shared_name = unique("Shared tenant agent")
    local = create_runbook(client, ops, name=shared_name)
    remote = create_runbook(client, other, name=shared_name)
    assert local.status_code == 200, local.text
    assert remote.status_code == 200, remote.text
    local_runbook = local.json()["result"]
    remote_runbook = remote.json()["result"]
    remote_run = start_run(client, other, remote_runbook["id"])
    assert remote_run.status_code == 200, remote_run.text
    remote_run_id = remote_run.json()["result"]["id"]

    assert client.get(f"/api/agents/runbooks/{remote_runbook['id']}", headers=ops).status_code == 404
    assert client.get(f"/api/agents/runs/{remote_run_id}", headers=ops).status_code == 404
    assert client.get(f"/api/agents/runs/{remote_run_id}/evidence", headers=admin).status_code == 404
    assert client.get(f"/api/agents/runbooks/{local_runbook['id']}", headers=other).status_code == 404
    cross_tenant_start = start_run(client, ops, remote_runbook["id"])
    assert cross_tenant_start.status_code == 400, cross_tenant_start.text
    assert "agent runbook not found" in cross_tenant_start.text


def _other_tenant_headers() -> dict[str, str]:
    suffix = uuid4().hex[:10]
    with SessionLocal() as db:
        organization = Organization(name=f"Agents tenant {suffix}")
        user = User(
            username=f"agents-{suffix}@example.test",
            password_hash="not-used",
            display_name="Agents tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(Membership(organization_id=organization.id, user_id=user.id, role="platform_admin"))
        db.commit()
        actor = Actor(user.id, user.username, organization.id, "platform_admin")
    return {"Authorization": f"Bearer {issue_token(actor)}"}
