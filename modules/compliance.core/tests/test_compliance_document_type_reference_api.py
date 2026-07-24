from __future__ import annotations

from dataclasses import FrozenInstanceError
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import SessionLocal
from uok.host.security import parse_token
from uok.kernel.security import Actor
from uok_compliance_core.public_api import (
    resolve_compliance_document_type_references,
)

from compliance_test_support import (
    create_document_type,
    install_compliance,
    transition_document_type,
)


def test_reference_batch_is_frozen_ordered_and_lifecycle_aware(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_compliance(client, admin)
    suffix = uuid4().hex[:8].upper()
    active = _create(client, ops, suffix, "ACTIVE")
    inactive = _create(client, ops, suffix, "INACTIVE")
    archived = _create(client, ops, suffix, "ARCHIVED")
    deactivated = transition_document_type(
        client,
        ops,
        "DeactivateComplianceDocumentType",
        str(inactive["id"]),
        1,
        "Reference lifecycle proof",
        f"deactivate-reference-{suffix}",
    )
    assert deactivated.status_code == 200, deactivated.text
    archived_response = transition_document_type(
        client,
        ops,
        "ArchiveComplianceDocumentType",
        str(archived["id"]),
        1,
        "Reference lifecycle proof",
        f"archive-reference-{suffix}",
    )
    assert archived_response.status_code == 200, archived_response.text
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])

    requested_ids = [
        str(inactive["id"]),
        "missing-document-type",
        str(archived["id"]),
        str(active["id"]),
    ]
    with SessionLocal() as db:
        values = resolve_compliance_document_type_references(
            db,
            actor,
            requested_ids,
        )
        assert [
            value.compliance_document_type_id
            for value in values
        ] == requested_ids
        assert [value.status for value in values] == [
            "unavailable",
            "missing",
            "unavailable",
            "ready",
        ]
        assert values[0].canonical_name == inactive["canonical_name"]
        assert values[0].lifecycle_status == "inactive"
        assert values[2].canonical_name == archived["canonical_name"]
        assert values[2].lifecycle_status == "archived"
        options = resolve_compliance_document_type_references(db, actor)
        option_ids = {
            value.compliance_document_type_id
            for value in options
        }
        assert active["id"] in option_ids
        assert inactive["id"] not in option_ids
        assert archived["id"] not in option_ids
        with pytest.raises(FrozenInstanceError):
            values[0].canonical_name = "Changed"  # type: ignore[misc]

        denied_actor = Actor(
            actor.user_id,
            actor.username,
            actor.organization_id,
            "registered_user",
        )
        denied = resolve_compliance_document_type_references(
            db,
            denied_actor,
            [str(active["id"])],
        )
        assert denied[0].status == "denied"
        assert denied[0].canonical_name is None
        with pytest.raises(PermissionError, match="compliance.read"):
            resolve_compliance_document_type_references(db, denied_actor)


def test_reference_batch_fails_closed_when_provider_is_disabled(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_compliance(client, admin)
    suffix = uuid4().hex[:8].upper()
    document_type = _create(client, ops, suffix, "DISABLED")
    actor = parse_token(ops["Authorization"].split(" ", 1)[1])
    response = client.post(
        "/api/modules/compliance.core/disable",
        headers=admin,
    )
    assert response.status_code == 200, response.text
    try:
        with SessionLocal() as db:
            resolution = resolve_compliance_document_type_references(
                db,
                actor,
                [str(document_type["id"])],
            )[0]
            assert resolution.status == "unavailable"
            assert resolution.canonical_name is None
            with pytest.raises(ValueError, match="not operational"):
                resolve_compliance_document_type_references(db, actor)
    finally:
        enabled = client.post(
            "/api/modules/compliance.core/enable",
            headers=admin,
        )
        assert enabled.status_code == 200, enabled.text


def _create(
    client: TestClient,
    headers: dict[str, str],
    suffix: str,
    scope: str,
) -> dict[str, object]:
    return create_document_type(
        client,
        headers,
        code=f"{scope}-DOCUMENT-{suffix}",
        name=f"{scope.title()} Document {suffix}",
        category="Trade",
        idempotency_key=f"create-{scope.lower()}-{suffix}",
    )
