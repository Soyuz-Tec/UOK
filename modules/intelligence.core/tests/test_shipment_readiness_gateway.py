from __future__ import annotations

from dataclasses import replace
from datetime import date

import pytest

from uok.kernel.security import Actor
from uok_intelligence_core._internal.delivery import shipment_gateway
from uok_shipments_core.public_api import ShipmentReadinessSnapshotDTO

AS_OF = date(2026, 7, 18)
EXPIRING_SOON_THROUGH = date(2026, 8, 17)


@pytest.mark.parametrize(
    ("overrides", "message"),
    (
        ({"required_total": -1}, "negative count"),
        ({"required_total": 1}, "inconsistent requirement counts"),
        ({"document_instance_total": 1}, "inconsistent instance counts"),
        (
            {
                "document_instance_total": 1,
                "document_instance_recorded": 1,
            },
            "inconsistent expiry eligibility",
        ),
        (
            {"document_instance_expiry_not_recorded": 1},
            "inconsistent missing expiry counts",
        ),
        (
            {
                "document_instance_total": 1,
                "document_instance_recorded": 1,
                "document_instance_expiry_evaluated": 1,
                "document_instance_expiry_not_recorded": 1,
                "document_instance_expired": 1,
            },
            "overlapping expiry counts",
        ),
        (
            {
                "document_instance_total": 1,
                "document_instance_verified": 1,
                "document_instance_expiry_evaluated": 1,
                "document_instance_expired": 1,
                "next_document_expiry_on": date(2026, 7, 17),
            },
            "past next expiry date",
        ),
        (
            {"next_document_expiry_on": AS_OF},
            "inconsistent next expiry presence",
        ),
        (
            {
                "document_instance_total": 1,
                "document_instance_verified": 1,
                "document_instance_expiry_evaluated": 1,
            },
            "inconsistent next expiry presence",
        ),
        (
            {
                "document_instance_total": 1,
                "document_instance_verified": 1,
                "document_instance_expiry_evaluated": 1,
                "document_instance_expiring_soon": 1,
                "next_document_expiry_on": date(2026, 8, 18),
            },
            "inconsistent next expiry window",
        ),
        (
            {
                "document_instance_total": 1,
                "document_instance_verified": 1,
                "document_instance_expiry_evaluated": 1,
                "next_document_expiry_on": AS_OF,
            },
            "inconsistent next expiry window",
        ),
    ),
)
def test_gateway_rejects_malformed_owner_aggregates(
    monkeypatch: pytest.MonkeyPatch,
    overrides: dict[str, object],
    message: str,
) -> None:
    snapshot = replace(_valid_snapshot(), **overrides)
    monkeypatch.setattr(
        shipment_gateway,
        "resolve_shipment_readiness_snapshots",
        lambda *_args, **_kwargs: (snapshot,),
    )
    actor = Actor("user-1", "viewer", "org-1", "viewer")

    with pytest.raises(ValueError, match=message):
        shipment_gateway.load_shipment_readiness_facts(
            None,  # type: ignore[arg-type]
            actor,
            AS_OF,
            EXPIRING_SOON_THROUGH,
        )


def _valid_snapshot() -> ShipmentReadinessSnapshotDTO:
    return ShipmentReadinessSnapshotDTO(
        shipment_id="shipment-1",
        status="ready",
        code="SHIPMENT-1",
        lifecycle_status="planned",
        required_total=0,
        required_satisfied=0,
        required_missing=0,
        required_received=0,
        required_waived=0,
        required_not_applicable=0,
        optional_total=0,
        document_instance_total=0,
        document_instance_draft=0,
        document_instance_recorded=0,
        document_instance_verified=0,
        document_instance_rejected=0,
        document_instance_superseded=0,
        document_instance_expiry_evaluated=0,
        document_instance_expiry_not_recorded=0,
        document_instance_expired=0,
        document_instance_expiring_soon=0,
        next_document_expiry_on=None,
        status_summary="Shipment readiness facts are available.",
        open_path="/?view=shipments&shipment_id=shipment-1",
    )
