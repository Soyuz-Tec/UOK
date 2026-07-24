from __future__ import annotations

from starlette.testclient import TestClient

from tests.helpers import command
from uok.host.database import SessionLocal
from uok.host.security import issue_token
from uok.kernel.security import Actor
from uok.kernel_models import Membership, Organization, User


def install_compliance(
    client: TestClient,
    headers: dict[str, str],
) -> None:
    response = client.post(
        "/api/modules/compliance.core/install",
        headers=headers,
    )
    assert response.status_code == 200, response.text


def create_document_type(
    client: TestClient,
    headers: dict[str, str],
    *,
    code: str,
    name: str,
    idempotency_key: str,
    description: str | None = None,
    category: str | None = None,
) -> dict[str, object]:
    response = command(
        client,
        headers,
        "CreateComplianceDocumentType",
        {
            "code": code,
            "canonical_name": name,
            "description": description,
            "category": category,
        },
        idempotency_key,
    )
    assert response.status_code == 200, response.text
    return response.json()["result"]


def transition_document_type(
    client: TestClient,
    headers: dict[str, str],
    command_name: str,
    document_type_id: str,
    expected_version: int,
    reason: str,
    idempotency_key: str,
):
    return command(
        client,
        headers,
        command_name,
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": expected_version,
            "reason": reason,
        },
        idempotency_key,
    )


def other_tenant_headers(suffix: str) -> dict[str, str]:
    with SessionLocal() as db:
        organization = Organization(name=f"Compliance registry tenant {suffix}")
        user = User(
            username=f"compliance-{suffix.lower()}@example.test",
            password_hash="not-used",
            display_name="Compliance registry tenant admin",
        )
        db.add_all((organization, user))
        db.flush()
        db.add(
            Membership(
                organization_id=organization.id,
                user_id=user.id,
                role="platform_admin",
            )
        )
        db.commit()
        actor = Actor(
            user.id,
            user.username,
            organization.id,
            "platform_admin",
        )
    return {"Authorization": f"Bearer {issue_token(actor)}"}


__all__ = [
    "create_document_type",
    "install_compliance",
    "other_tenant_headers",
    "transition_document_type",
]
