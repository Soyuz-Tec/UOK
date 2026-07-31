import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type {
  LocationDefinition,
  LocationNameHistory,
} from "../../web/src/types";

export const activeLocation: LocationDefinition = {
  id: "location-1",
  code: "SGSIN",
  canonical_name: "Port of Singapore",
  location_type: "port",
  country_code: "SG",
  status: "active",
  version: 3,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-16T10:00:00Z",
  updated_at: "2026-07-16T11:00:00Z",
  archived_at: null,
};

export const warehouseLocation: LocationDefinition = {
  ...activeLocation,
  id: "location-2",
  code: "NLRTM-WH1",
  canonical_name: "Rotterdam Warehouse One",
  location_type: "warehouse",
  country_code: "NL",
  version: 1,
};

export const archivedLocation: LocationDefinition = {
  ...activeLocation,
  id: "location-3",
  code: "OLD-PORT",
  canonical_name: "Legacy Port",
  status: "archived",
  version: 4,
  archived_at: "2026-07-16T12:00:00Z",
};

export const nameHistory: LocationNameHistory[] = [{
  id: "history-1",
  location_definition_id: activeLocation.id,
  previous_name: "Singapore Harbour",
  new_name: "Port of Singapore",
  reason: "Canonical naming review",
  changed_by_user_id: "user-1",
  changed_at: "2026-07-16T11:00:00Z",
}];

type HostOverrides = Omit<Partial<ModuleSurfaceHostContext>, "session"> & {
  session?: Partial<ModuleSurfaceHostContext["session"]>;
};

export function locationHost(overrides: HostOverrides = {}): ModuleSurfaceHostContext {
  const { session, ...hostOverrides } = overrides;
  return {
    session: {
      token: "test-token",
      generation: 0,
      onUnauthorized: vi.fn(),
      ...session,
    },
    currentUserRole: "ops_manager",
    appearance: "system",
    moduleRows: [locationModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    ...hostOverrides,
  };
}

export const locationModuleRow = {
  name: "locations.core",
  status: "installed",
  recorded_status: "installed",
  reconciliation_required: false,
  maturity: "integration_tested" as const,
  version: "3.1.0-alpha.3",
  kind: "capability_module",
  installable: true,
  uninstallable: true,
  updatable: true,
  maintainable: true,
  required: false,
  lifecycle: ["available", "installed", "disabled", "upgraded", "uninstalled"],
  lifecycle_state_declared: true,
  dependencies: [],
  dependents: [],
};

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
