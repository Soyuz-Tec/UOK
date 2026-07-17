from __future__ import annotations

from uuid import uuid4

from sqlalchemy import select
from starlette.testclient import TestClient

from tests.helpers import auth, command
from uok.host.database import SessionLocal
from uok.kernel_models import EventRecord
from uok.util import loads

from compliance_test_support import (
    install_compliance,
    transition_document_type,
)


def test_archive_restore_filters_updates_and_audit_correlation(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    viewer = auth(client, "viewer", "viewer123")
    install_compliance(client, admin)
    suffix = uuid4().hex[:8].upper()
    created = command(
        client,
        ops,
        "CreateComplianceDocumentType",
        {
            "code": f"COMMERCIAL-INVOICE-{suffix}",
            "canonical_name": f"Commercial Invoice {suffix}",
            "category": "Commercial",
        },
        f"archive-create-{suffix}",
    )
    assert created.status_code == 200, created.text
    document_type_id = created.json()["result"]["id"]
    updated = command(
        client,
        ops,
        "UpdateComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 1,
            "description": "Tenant-approved commercial vocabulary",
            "reason": "Add registry context",
        },
        f"archive-update-{suffix}",
    )
    assert updated.status_code == 200, updated.text

    archived = transition_document_type(
        client,
        ops,
        "ArchiveComplianceDocumentType",
        document_type_id,
        2,
        "Retired from the registry",
        f"archive-command-{suffix}",
    )
    assert archived.status_code == 200, archived.text
    assert archived.json()["result"]["status"] == "archived"
    assert archived.json()["result"]["version"] == 3
    assert archived.json()["result"]["archived_at"] is not None
    default_rows = client.get(
        "/api/compliance/document-types",
        headers=viewer,
    ).json()
    assert all(row["id"] != document_type_id for row in default_rows)
    archived_rows = client.get(
        "/api/compliance/document-types?include_archived=true",
        headers=viewer,
    ).json()
    assert any(row["id"] == document_type_id for row in archived_rows)

    rejected_update = command(
        client,
        ops,
        "UpdateComplianceDocumentType",
        {
            "compliance_document_type_id": document_type_id,
            "expected_version": 3,
            "description": "Should not change",
            "reason": "Should fail",
        },
        f"archive-rejected-update-{suffix}",
    )
    assert rejected_update.status_code == 400, rejected_update.text

    restored = transition_document_type(
        client,
        ops,
        "RestoreComplianceDocumentType",
        document_type_id,
        3,
        "Registry recovery approved",
        f"archive-restore-{suffix}",
    )
    assert restored.status_code == 200, restored.text
    assert restored.json()["result"]["status"] == "active"
    assert restored.json()["result"]["version"] == 4
    assert restored.json()["result"]["archived_at"] is None

    successful = (created, updated, archived, restored)
    command_ids = {response.json()["command_id"] for response in successful}
    with SessionLocal() as db:
        events = db.scalars(
            select(EventRecord).where(
                EventRecord.object_type == "ComplianceDocumentType",
                EventRecord.object_id == document_type_id,
            )
        ).all()
        assert {
            loads(event.payload_json)["correlation_id"]
            for event in events
        } == command_ids
        assert {event.event_type for event in events} == {
            "ComplianceDocumentTypeCreated",
            "ComplianceDocumentTypeUpdated",
            "ComplianceDocumentTypeArchived",
            "ComplianceDocumentTypeRestored",
        }
