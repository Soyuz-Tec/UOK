import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type { LocationReference, RouteDefinition, RouteNameHistory } from "../../web/src/types";

export const originOption: LocationReference = {
  location_definition_id: "location-origin",
  status: "ready",
  code: "NG-APAPA",
  canonical_name: "Apapa Port",
  location_type: "port",
  country_code: "NG",
  status_summary: "Location is active.",
};

export const waypointOption: LocationReference = {
  location_definition_id: "location-waypoint",
  status: "ready",
  code: "ES-ALGECIRAS",
  canonical_name: "Port of Algeciras",
  location_type: "port",
  country_code: "ES",
  status_summary: "Location is active.",
};

export const secondWaypointOption: LocationReference = {
  location_definition_id: "location-waypoint-2",
  status: "ready",
  code: "GB-FELIXSTOWE",
  canonical_name: "Port of Felixstowe",
  location_type: "port",
  country_code: "GB",
  status_summary: "Location is active.",
};

export const destinationOption: LocationReference = {
  location_definition_id: "location-destination",
  status: "ready",
  code: "NL-ROTTERDAM",
  canonical_name: "Port of Rotterdam",
  location_type: "port",
  country_code: "NL",
  status_summary: "Location is active.",
};

export const locationOptions = [originOption, waypointOption, secondWaypointOption, destinationOption];

export const activeRoute: RouteDefinition = {
  id: "route-1",
  code: "RCN-NG-NL",
  canonical_name: "Nigeria to Netherlands RCN Corridor",
  mode_hint: "multimodal",
  status: "active",
  version: 3,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-16T10:00:00Z",
  updated_at: "2026-07-16T11:00:00Z",
  archived_at: null,
  stops: [
    { sequence: 0, stop_role: "origin", location: originOption },
    { sequence: 1, stop_role: "waypoint", location: waypointOption },
    { sequence: 2, stop_role: "destination", location: destinationOption },
  ],
};

export const archivedRoute: RouteDefinition = {
  ...activeRoute,
  id: "route-2",
  code: "OLD-SEA-LANE",
  canonical_name: "Legacy Sea Lane",
  mode_hint: "sea",
  status: "archived",
  version: 4,
  archived_at: "2026-07-16T12:00:00Z",
};

export const routeHistory: RouteNameHistory[] = [{
  id: "history-1",
  route_definition_id: activeRoute.id,
  previous_name: "Nigeria Netherlands Lane",
  new_name: activeRoute.canonical_name,
  reason: "Canonical naming review",
  changed_by_user_id: "user-1",
  changed_at: "2026-07-16T11:00:00Z",
}];

export function routeHost(overrides: Partial<ModuleSurfaceHostContext> = {}): ModuleSurfaceHostContext {
  return {
    token: "test-token",
    currentUserRole: "ops_manager",
    appearance: "system",
    moduleRows: [routeModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

export const routeModuleRow = {
  name: "routes.core", status: "installed", recorded_status: "installed",
  reconciliation_required: false, maturity: "integration_tested" as const,
  version: "3.1.0-alpha.3", kind: "capability_module", installable: true,
  uninstallable: true, updatable: true, maintainable: true, required: false,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
  lifecycle_state_declared: true, dependencies: ["locations.core"], dependents: [],
};

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
}
