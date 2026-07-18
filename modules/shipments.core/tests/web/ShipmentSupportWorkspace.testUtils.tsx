import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type {
  LocationReference,
  PartyReference,
  RoutePathReference,
  Shipment,
  ShipmentStatusHistory,
} from "../../web/src/types";

export const shipperParty: PartyReference = {
  status: "ready",
  display_label: "Kayilan RCN Exporter",
  status_summary: "Party is active.",
  open_path: "/?view=contacts&party_id=party-shipper",
};

export const consigneeParty: PartyReference = {
  status: "ready",
  display_label: "Thoothukudi Importer",
  status_summary: "Party is active.",
  open_path: "/?view=contacts&party_id=party-consignee",
};

export const originLocation: LocationReference = {
  location_definition_id: "location-origin",
  status: "ready",
  code: "CI-ABJ",
  canonical_name: "Abidjan Port",
  location_type: "port",
  country_code: "CI",
  status_summary: "Location is active.",
};

export const destinationLocation: LocationReference = {
  location_definition_id: "location-destination",
  status: "ready",
  code: "IN-VOC",
  canonical_name: "V.O.C. Port Thoothukudi",
  location_type: "port",
  country_code: "IN",
  status_summary: "Location is active.",
};

export const routeOption: RoutePathReference = {
  route_definition_id: "route-africa-voc",
  status: "ready",
  code: "RCN-AFRICA-VOC",
  canonical_name: "Africa to V.O.C. RCN Corridor",
  mode_hint: "sea",
  ordered_location_ids: [originLocation.location_definition_id, destinationLocation.location_definition_id],
  status_summary: "Route is active.",
};

export const activeShipment: Shipment = {
  id: "shipment-1",
  code: "RCN-AFRICA-VOC-001",
  shipper_party_id: "party-shipper",
  consignee_party_id: "party-consignee",
  origin_location_id: originLocation.location_definition_id,
  destination_location_id: destinationLocation.location_definition_id,
  route_definition_id: routeOption.route_definition_id,
  planned_departure_on: "2026-08-01",
  planned_arrival_on: "2026-08-21",
  status: "draft",
  version: 1,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-16T10:00:00Z",
  updated_at: "2026-07-16T10:00:00Z",
  shipper: shipperParty,
  consignee: consigneeParty,
  origin: originLocation,
  destination: destinationLocation,
  route: routeOption,
};

export const closedShipment: Shipment = {
  ...activeShipment,
  id: "shipment-2",
  code: "RCN-AFRICA-VOC-OLD",
  status: "closed",
  version: 6,
  planned_departure_on: "2026-05-01",
  planned_arrival_on: "2026-05-22",
};

export const shipmentHistory: ShipmentStatusHistory[] = [{
  id: "history-1",
  shipment_id: activeShipment.id,
  previous_status: "draft",
  new_status: "planned",
  reason: "Export plan approved",
  changed_by_user_id: "user-1",
  changed_at: "2026-07-16T11:00:00Z",
  version: 2,
}];

export function shipmentHost(overrides: Partial<ModuleSurfaceHostContext> = {}): ModuleSurfaceHostContext {
  return {
    token: "test-token",
    currentUserRole: "ops_manager",
    appearance: "system",
    moduleRows: [shipmentModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

export const shipmentModuleRow = {
  name: "shipments.core", status: "installed", recorded_status: "installed",
  reconciliation_required: false, maturity: "integration_tested" as const,
  version: "3.1.0-alpha.3", kind: "business_module", installable: true,
  uninstallable: true, updatable: true, maintainable: true, required: false,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
  lifecycle_state_declared: true,
  dependencies: ["compliance.core", "contacts.core", "locations.core", "routes.core"],
  dependents: [],
};

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
