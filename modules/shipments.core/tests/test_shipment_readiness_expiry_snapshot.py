from __future__ import annotations

from datetime import date

import pytest
from starlette.testclient import TestClient

from shipment_readiness_test_support import (
    actor_from_headers,
    add_shipment,
    document_instance,
    unique_suffix,
)
from shipment_test_support import install_shipment_stack
from tests.helpers import auth
from uok.host.database import SessionLocal
from uok_shipments_core.public_api import resolve_shipment_readiness_snapshots


def test_expiry_snapshot_uses_inclusive_window_and_eligible_statuses(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    actor = actor_from_headers(ops)
    suffix = unique_suffix()
    as_of = date(2024, 2, 29)
    expiring_soon_through = date(2024, 3, 30)

    with SessionLocal() as db:
        shipment = add_shipment(db, actor, f"EXPIRY-{suffix}")
        instances = (
            document_instance(actor, shipment.id, 1, "recorded"),
            document_instance(
                actor,
                shipment.id,
                2,
                "verified",
                expires_on=date(2024, 2, 28),
            ),
            document_instance(
                actor,
                shipment.id,
                3,
                "recorded",
                expires_on=as_of,
            ),
            document_instance(
                actor,
                shipment.id,
                4,
                "verified",
                expires_on=expiring_soon_through,
            ),
            document_instance(
                actor,
                shipment.id,
                5,
                "recorded",
                expires_on=date(2024, 3, 31),
            ),
            document_instance(
                actor,
                shipment.id,
                6,
                "draft",
                expires_on=date(2024, 2, 28),
            ),
            document_instance(
                actor,
                shipment.id,
                7,
                "rejected",
                expires_on=date(2024, 3, 1),
            ),
            document_instance(
                actor,
                shipment.id,
                8,
                "superseded",
                expires_on=date(2024, 3, 1),
            ),
        )
        db.add_all(instances)
        db.commit()
        snapshot = resolve_shipment_readiness_snapshots(
            db,
            actor,
            [shipment.id],
            as_of=as_of,
            expiring_soon_through=expiring_soon_through,
        )[0]

    assert snapshot.document_instance_expiry_evaluated == 5
    assert snapshot.document_instance_expiry_not_recorded == 1
    assert snapshot.document_instance_expired == 1
    assert snapshot.document_instance_expiring_soon == 2
    assert snapshot.next_document_expiry_on == as_of


def test_next_expiry_excludes_past_dates_and_window_order_fails_closed(
    client: TestClient,
) -> None:
    admin = auth(client, "admin", "admin")
    ops = auth(client, "ops", "ops123")
    install_shipment_stack(client, admin)
    actor = actor_from_headers(ops)
    as_of = date(2026, 7, 18)

    with SessionLocal() as db:
        shipment = add_shipment(db, actor, f"PAST-{unique_suffix()}")
        db.add(document_instance(
            actor,
            shipment.id,
            1,
            "verified",
            expires_on=date(2026, 7, 17),
        ))
        db.commit()
        snapshot = resolve_shipment_readiness_snapshots(
            db,
            actor,
            [shipment.id],
            as_of=as_of,
            expiring_soon_through=date(2026, 8, 17),
        )[0]
        with pytest.raises(
            ValueError,
            match="expiring_soon_through cannot be earlier than as_of",
        ):
            resolve_shipment_readiness_snapshots(
                db,
                actor,
                [shipment.id],
                as_of=as_of,
                expiring_soon_through=date(2026, 7, 17),
            )

    assert snapshot.document_instance_expiry_evaluated == 1
    assert snapshot.document_instance_expired == 1
    assert snapshot.document_instance_expiring_soon == 0
    assert snapshot.next_document_expiry_on is None
