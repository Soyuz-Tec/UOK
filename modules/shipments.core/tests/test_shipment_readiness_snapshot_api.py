from __future__ import annotations

from dataclasses import FrozenInstanceError, fields
import pytest
from starlette.testclient import TestClient

from tests.helpers import auth
from uok.host.database import SessionLocal
from uok.kernel.security import Actor, has_permission
from uok_shipments_core.public_api import (
    ShipmentReadinessSnapshotDTO,
    resolve_shipment_readiness_snapshots,
)

from shipment_readiness_test_support import (
    FACT_FIELDS,
    actor_from_headers,
    add_shipment,
    assert_redacted,
    document_instance,
    requirement,
    unique_suffix,
)
from shipment_test_support import (
    install_shipment_stack,
    other_shipment_tenant_headers,
    temporarily_uninstall_module,
)


def test_readiness_snapshot_contract_counts_owner_facts_without_compliance(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    actor = actor_from_headers(ops)
    suffix = unique_suffix()

    with SessionLocal() as db:
        zero = add_shipment(db, actor, f"A-ZERO-{suffix}")
        mixed = add_shipment(
            db,
            actor,
            f"B-MIXED-{suffix}",
            shipment_id=f"safe/id?{suffix}",
            status="planned",
        )
        for index, status in enumerate(
            ("missing", "received", "waived", "not_applicable"),
            start=1,
        ):
            db.add(requirement(actor, mixed.id, index, "required", status))
        db.add(requirement(actor, mixed.id, 5, "optional", "missing"))
        for index, status in enumerate(
            ("draft", "recorded", "verified", "rejected", "superseded"),
            start=1,
        ):
            db.add(document_instance(actor, mixed.id, index, status))
        zero_id = zero.id
        mixed_id = mixed.id
        mixed_code = mixed.code
        db.commit()

    monkeypatch.setattr(
        "uok.kernel.security._role_grants_provider",
        lambda: {"shipment_reader_only": {"shipments.read"}},
    )
    readiness_actor = Actor(
        actor.user_id,
        actor.username,
        actor.organization_id,
        "shipment_reader_only",
    )
    assert has_permission(readiness_actor, "shipments.read")
    assert not has_permission(readiness_actor, "compliance.read")
    with SessionLocal() as db:
        snapshot = resolve_shipment_readiness_snapshots(db, readiness_actor, [mixed_id])[0]
        listed = resolve_shipment_readiness_snapshots(db, readiness_actor)
        zero_snapshot = resolve_shipment_readiness_snapshots(
            db,
            readiness_actor,
            [zero_id],
        )[0]

    assert snapshot.status == "ready"
    assert snapshot.code == mixed_code
    assert snapshot.lifecycle_status == "planned"
    assert (
        snapshot.required_total,
        snapshot.required_satisfied,
        snapshot.required_missing,
        snapshot.required_received,
        snapshot.required_waived,
        snapshot.required_not_applicable,
        snapshot.optional_total,
    ) == (4, 3, 1, 1, 1, 1, 1)
    assert (
        snapshot.document_instance_total,
        snapshot.document_instance_draft,
        snapshot.document_instance_recorded,
        snapshot.document_instance_verified,
        snapshot.document_instance_rejected,
        snapshot.document_instance_superseded,
    ) == (5, 1, 1, 1, 1, 1)
    assert snapshot.open_path == (
        f"/?view=shipments&shipment_id=safe%2Fid%3F{suffix}"
    )
    assert [item.shipment_id for item in listed if item.shipment_id in {zero_id, mixed_id}] == [
        zero_id,
        mixed_id,
    ]
    assert all(getattr(zero_snapshot, name) == 0 for name in FACT_FIELDS[2:-1])
    with pytest.raises(FrozenInstanceError):
        snapshot.required_missing = 0  # type: ignore[misc]


def test_readiness_snapshot_resolution_is_ordered_tenant_safe_and_redacted(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    actor = actor_from_headers(ops)
    remote_actor = actor_from_headers(other_shipment_tenant_headers(unique_suffix()))
    suffix = unique_suffix()

    with SessionLocal() as db:
        local = add_shipment(db, actor, f"LOCAL-{suffix}")
        remote = add_shipment(db, remote_actor, f"REMOTE-{suffix}")
        db.commit()
        resolved = resolve_shipment_readiness_snapshots(
            db,
            actor,
            [local.id, remote.id, "missing-shipment", local.id],
        )
        denied = resolve_shipment_readiness_snapshots(
            db,
            Actor(actor.user_id, actor.username, actor.organization_id, "registered_user"),
            [local.id, local.id],
        )
        with pytest.raises(PermissionError, match="shipments.read"):
            resolve_shipment_readiness_snapshots(
                db,
                Actor(
                    actor.user_id,
                    actor.username,
                    actor.organization_id,
                    "registered_user",
                ),
            )

    assert [row.shipment_id for row in resolved] == [
        local.id,
        remote.id,
        "missing-shipment",
        local.id,
    ]
    assert [row.status for row in resolved] == ["ready", "missing", "missing", "ready"]
    assert_redacted(resolved[1], "missing")
    assert_redacted(resolved[2], "missing")
    assert len(denied) == 2
    assert all(row.shipment_id == local.id for row in denied)
    for row in denied:
        assert_redacted(row, "denied")

    with temporarily_uninstall_module(client, admin, "intelligence.core"):
        disabled_shipments = client.post(
            "/api/modules/shipments.core/disable",
            headers=admin,
        )
        assert disabled_shipments.status_code == 200, disabled_shipments.text
        try:
            with SessionLocal() as db:
                unavailable = resolve_shipment_readiness_snapshots(
                    db,
                    actor,
                    [local.id],
                )
                with pytest.raises(
                    ValueError,
                    match="shipments.core is not installed or enabled",
                ):
                    resolve_shipment_readiness_snapshots(db, actor)
            assert_redacted(unavailable[0], "unavailable")
        finally:
            enabled_shipments = client.post(
                "/api/modules/shipments.core/enable",
                headers=admin,
            )
            assert enabled_shipments.status_code == 200, enabled_shipments.text


def test_readiness_snapshot_list_distinguishes_an_authorized_empty_tenant(
    client: TestClient,
) -> None:
    empty_headers = other_shipment_tenant_headers(unique_suffix())
    install_shipment_stack(client, empty_headers)
    empty_actor = actor_from_headers(empty_headers)

    with SessionLocal() as db:
        assert resolve_shipment_readiness_snapshots(db, empty_actor) == ()


def test_temporary_module_uninstall_does_not_suppress_body_failures(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")

    with pytest.raises(RuntimeError, match="body failure"):
        with temporarily_uninstall_module(client, admin, "intelligence.core"):
            raise RuntimeError("body failure")


def test_readiness_snapshot_dto_has_only_the_exact_value_contract() -> None:
    assert [field.name for field in fields(ShipmentReadinessSnapshotDTO)] == [
        "shipment_id",
        "status",
        "code",
        "lifecycle_status",
        "required_total",
        "required_satisfied",
        "required_missing",
        "required_received",
        "required_waived",
        "required_not_applicable",
        "optional_total",
        "document_instance_total",
        "document_instance_draft",
        "document_instance_recorded",
        "document_instance_verified",
        "document_instance_rejected",
        "document_instance_superseded",
        "status_summary",
        "open_path",
    ]
