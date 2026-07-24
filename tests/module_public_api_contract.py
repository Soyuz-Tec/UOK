from __future__ import annotations

import re

from uok.module_manifest_loader import load_module_manifests


MODULES = {
    "planning": {
        "package": "uok_planning_core",
        "folder": "planning.core",
        "symbols": {
            "api_router",
            "assert_planning_replay_visible",
            "command_handlers",
            "command_permissions",
            "dashboard_counts",
            "evidence",
            "role_grants",
        },
    },
    "contacts": {
        "package": "uok_contacts_core",
        "folder": "contacts.core",
        "symbols": {
            "PartyReferenceResolution",
            "api_router",
            "command_handlers",
            "command_permissions",
            "dashboard_counts",
            "evidence",
            "resolve_party_reference",
            "role_grants",
        },
    },
    "compliance": {
        "package": "uok_compliance_core",
        "folder": "compliance.core",
        "symbols": {
            "ComplianceDocumentTypeReferenceDTO",
            "api_router",
            "command_handlers",
            "command_permissions",
            "resolve_compliance_document_type_references",
            "role_grants",
        },
    },
    "product": {
        "package": "uok_product_master",
        "folder": "product.master",
        "symbols": {
            "api_router",
            "command_handlers",
            "command_permissions",
            "role_grants",
        },
    },
    "locations": {
        "package": "uok_locations_core",
        "folder": "locations.core",
        "symbols": {
            "LocationReferenceResolution",
            "api_router",
            "command_handlers",
            "command_permissions",
            "resolve_location_references",
            "role_grants",
        },
    },
    "routes": {
        "package": "uok_routes_core",
        "folder": "routes.core",
        "symbols": {
            "RoutePathReferenceDTO",
            "RouteReferenceDTO",
            "api_router",
            "command_handlers",
            "command_permissions",
            "resolve_route_path_references",
            "resolve_route_reference",
            "role_grants",
        },
    },
    "shipments": {
        "package": "uok_shipments_core",
        "folder": "shipments.core",
        "symbols": {
            "ShipmentReadinessSnapshotDTO",
            "ShipmentReferenceDTO",
            "api_router",
            "command_handlers",
            "command_permissions",
            "resolve_shipment_readiness_snapshots",
            "resolve_shipment_reference",
            "role_grants",
        },
    },
    "intelligence": {
        "package": "uok_intelligence_core",
        "folder": "intelligence.core",
        "symbols": {
            "api_router",
            "role_grants",
        },
    },
}

PYTHON_SCAN_ROOTS = ("src", "scripts", "modules", "tests")
FRONTEND_SCAN_ROOTS = ("web", "modules")
FRONTEND_EXCLUDED_PARTS = {"node_modules", "dist", "coverage"}
FRONTEND_SPECIFIER_PATTERN = re.compile(
    r"(?:\bfrom\s+|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)[\"']([^\"']+)[\"']"
)


def _owned_orm_symbols() -> dict[str, set[str]]:
    manifests = load_module_manifests()
    return {
        owner: {
            str(entry)
            for entry in manifests[str(contract["folder"])]["owned_tables"]
            if ":" not in str(entry)
        }
        for owner, contract in MODULES.items()
    }


OWNED_ORM_SYMBOLS = _owned_orm_symbols()

__all__ = [
    "FRONTEND_EXCLUDED_PARTS",
    "FRONTEND_SCAN_ROOTS",
    "FRONTEND_SPECIFIER_PATTERN",
    "MODULES",
    "OWNED_ORM_SYMBOLS",
    "PYTHON_SCAN_ROOTS",
]
