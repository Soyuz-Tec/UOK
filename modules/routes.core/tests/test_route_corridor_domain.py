from __future__ import annotations

from dataclasses import FrozenInstanceError
from datetime import datetime, timezone
from pathlib import Path

import pytest
from pydantic import ValidationError

from uok.module_manifest_loader import load_module_manifests
from uok_routes_core._internal.delivery.schemas import (
    LocationReferenceResponse,
    RouteDefinitionCreateRequest,
    RouteDefinitionResponse,
    RouteDefinitionUpdateRequest,
    RouteStopResponse,
)
from uok_routes_core._internal.persistence.models import RouteDefinition, RouteNameHistory, RouteStop, owned_models
from uok_routes_core.public_api import RoutePathReferenceDTO, RouteReferenceDTO, __all__ as public_symbols


def test_route_definition_normalizes_identity_mode_and_ordered_path() -> None:
    request = RouteDefinitionCreateRequest(
        code=" ng__rcn_corridor ",
        canonical_name="  RCN Export Corridor  ",
        mode_hint=" MULTIMODAL ",
        origin_location_id=" origin ",
        waypoint_location_ids=[" waypoint-1 ", " waypoint-2 "],
        destination_location_id=" destination ",
    )
    assert request.code == "NG-RCN-CORRIDOR"
    assert request.canonical_name == "RCN Export Corridor"
    assert request.mode_hint == "multimodal"
    assert [request.origin_location_id, *request.waypoint_location_ids, request.destination_location_id] == [
        "origin", "waypoint-1", "waypoint-2", "destination",
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {"origin_location_id": "same", "destination_location_id": "same"},
        {"origin_location_id": "a", "destination_location_id": "b", "waypoint_location_ids": ["a"]},
        {"origin_location_id": "a", "destination_location_id": "b", "waypoint_location_ids": [str(i) for i in range(9)]},
    ],
)
def test_route_definition_rejects_repeated_or_oversized_paths(payload: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        RouteDefinitionCreateRequest.model_validate({
            "code": "ROUTE",
            "canonical_name": "Route",
            **payload,
        })


def test_route_update_requires_whole_path_positive_version_and_immutable_code() -> None:
    for payload in (
        {"route_definition_id": "route-1", "expected_version": 0, "canonical_name": "Updated"},
        {"route_definition_id": "route-1", "expected_version": 1, "code": "NEW-CODE"},
        {"route_definition_id": "route-1", "expected_version": 1, "origin_location_id": "origin"},
    ):
        with pytest.raises(ValidationError):
            RouteDefinitionUpdateRequest.model_validate(payload)


def test_route_boundary_dtos_are_frozen_and_exclude_tenant_identity() -> None:
    now = datetime.now(timezone.utc)
    location = LocationReferenceResponse(
        location_definition_id="location-1",
        status="ready",
        code="NG-PORT",
        canonical_name="Port",
        location_type="port",
        country_code="NG",
        status_summary="Location is active.",
    )
    response = RouteDefinitionResponse(
        id="route-1",
        code="ROUTE-1",
        canonical_name="Route One",
        mode_hint="sea",
        status="active",
        version=1,
        created_by_user_id="user-1",
        updated_by_user_id="user-1",
        created_at=now,
        updated_at=now,
        archived_at=None,
        stops=(RouteStopResponse(sequence=0, stop_role="origin", location=location),),
    )
    assert "organization_id" not in response.model_dump()
    with pytest.raises(ValidationError, match="frozen"):
        response.canonical_name = "Changed"  # type: ignore[misc]
    reference = RouteReferenceDTO("route-1", "ready", "ROUTE-1", "Route One", "sea", "Route is active.")
    with pytest.raises(FrozenInstanceError):
        reference.canonical_name = "Changed"  # type: ignore[misc]
    path_reference = RoutePathReferenceDTO(
        "route-1",
        "ready",
        "ROUTE-1",
        "Route One",
        "sea",
        ("origin", "destination"),
        "Route is active.",
    )
    with pytest.raises(FrozenInstanceError):
        path_reference.ordered_location_ids = ()  # type: ignore[misc]


def test_route_owner_contract_is_exact_and_has_no_foreign_location_table_reference() -> None:
    assert owned_models() == {
        "RouteDefinition": RouteDefinition,
        "RouteStop": RouteStop,
        "RouteNameHistory": RouteNameHistory,
    }
    assert public_symbols == [
        "RoutePathReferenceDTO",
        "RouteReferenceDTO",
        "api_router",
        "command_handlers",
        "command_permissions",
        "resolve_route_path_references",
        "resolve_route_reference",
        "role_grants",
    ]
    assert [RouteDefinition.__tablename__, RouteStop.__tablename__, RouteNameHistory.__tablename__] == [
        "route_definitions", "route_stops", "route_name_history",
    ]
    root = Path(__file__).parents[1]
    migration = (root / "migrations" / "001_routes_core.sql").read_text(encoding="utf-8")
    assert "location_definitions" not in migration
    assert "location_definition_id VARCHAR(36) NOT NULL" in migration
    assert "REFERENCES route_definitions(id)" in migration


def test_route_manifest_declares_dependency_and_closed_executable_contract() -> None:
    manifest = load_module_manifests()["routes.core"]
    assert manifest["kind"] == "capability_module"
    assert manifest["maturity"] == "runtime_proven"
    assert manifest["dependencies"] == ["locations.core"]
    assert manifest["api_prefixes"] == ["/api/routes"]
    assert manifest["api_router"] == "uok_routes_core.public_api:api_router"
    assert manifest["model_exports"] == "uok_routes_core._internal.persistence.models:owned_models"
    assert set(manifest["commands"]) == {
        "CreateRouteDefinition", "UpdateRouteDefinition", "ArchiveRouteDefinition", "RestoreRouteDefinition",
    }
    assert set(manifest["events"]) == {
        "RouteDefinitionCreated", "RouteDefinitionUpdated", "RouteDefinitionArchived", "RouteDefinitionRestored",
    }
    assert set(manifest["permissions"]) == {"routes.read", "routes.manage"}
