from __future__ import annotations

from uuid import uuid4

from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok_compliance_core.public_api import (
    resolve_compliance_document_type_references,
)

from compliance_test_support import (
    create_document_type,
    install_compliance,
    other_tenant_headers,
)


def test_codes_reads_mutations_and_references_are_tenant_scoped(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    suffix = uuid4().hex[:8].upper()
    other = other_tenant_headers(suffix)
    install_compliance(client, admin)
    install_compliance(client, other)
    shared_code = f"CERTIFICATE-OF-ORIGIN-{suffix}"

    local = create_document_type(
        client,
        ops,
        code=shared_code,
        name=f"Local Certificate {suffix}",
        category="Origin",
        idempotency_key=f"local-compliance-{suffix}",
    )
    remote = create_document_type(
        client,
        other,
        code=shared_code,
        name=f"Remote Certificate {suffix}",
        category="Origin",
        idempotency_key=f"remote-compliance-{suffix}",
    )
    local_id = str(local["id"])
    remote_id = str(remote["id"])
    assert local_id != remote_id

    base = "/api/compliance/document-types"
    assert client.get(f"{base}/{remote_id}", headers=ops).status_code == 404
    assert (
        client.get(f"{base}/{remote_id}/name-history", headers=ops).status_code
        == 404
    )
    assert client.get(f"{base}/{local_id}", headers=other).status_code == 404
    assert client.get(f"{base}/{remote_id}", headers=other).status_code == 200
    assert all(
        row["id"] != remote_id
        for row in client.get(base, headers=ops).json()
    )

    commands = (
        "UpdateComplianceDocumentType",
        "DeactivateComplianceDocumentType",
        "ActivateComplianceDocumentType",
        "ArchiveComplianceDocumentType",
        "RestoreComplianceDocumentType",
    )
    for command_name in commands:
        payload: dict[str, object] = {
            "compliance_document_type_id": remote_id,
            "expected_version": 1,
            "reason": "Forbidden cross-tenant mutation",
        }
        if command_name == "UpdateComplianceDocumentType":
            payload["canonical_name"] = "Forbidden rename"
        denied = command(
            client,
            ops,
            command_name,
            payload,
            f"cross-tenant-{command_name}-{suffix}",
        )
        assert denied.status_code == 400, denied.text
        assert "compliance document type not found" in denied.text

    remote_detail = client.get(f"{base}/{remote_id}", headers=other)
    assert remote_detail.status_code == 200, remote_detail.text
    assert remote_detail.json()["canonical_name"] == (
        f"Remote Certificate {suffix}"
    )
    assert remote_detail.json()["status"] == "active"
    assert remote_detail.json()["version"] == 1

    local_actor = parse_token(ops["Authorization"].split(" ", 1)[1])
    with SessionLocal() as db:
        resolutions = resolve_compliance_document_type_references(
            db,
            local_actor,
            [remote_id, local_id],
        )
        assert [value.status for value in resolutions] == ["missing", "ready"]
        assert resolutions[0].canonical_name is None
