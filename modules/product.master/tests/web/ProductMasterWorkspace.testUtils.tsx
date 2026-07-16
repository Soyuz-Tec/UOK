import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";
import type {
  ProductDefinition,
  ProductNameHistory,
} from "../../web/src/types";

export const activeProduct: ProductDefinition = {
  id: "product-1",
  code: "RICE-001",
  canonical_name: "Rice",
  category: "Grain",
  grade: "A",
  specification: "Long grain",
  base_unit_code: "MT",
  status: "active",
  version: 3,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-16T10:00:00Z",
  updated_at: "2026-07-16T11:00:00Z",
  archived_at: null,
};

export const soyProduct: ProductDefinition = {
  ...activeProduct,
  id: "product-2",
  code: "SOY-001",
  canonical_name: "Soybean Meal",
  category: "Feed",
  version: 1,
};

export const archivedProduct: ProductDefinition = {
  ...activeProduct,
  id: "product-3",
  code: "OLD-001",
  canonical_name: "Legacy Product",
  status: "archived",
  version: 4,
  archived_at: "2026-07-16T12:00:00Z",
};

export const nameHistory: ProductNameHistory[] = [{
  id: "history-1",
  product_definition_id: activeProduct.id,
  previous_name: "Rice Old",
  new_name: "Rice",
  reason: "Canonical naming review",
  changed_by_user_id: "user-1",
  changed_at: "2026-07-16T11:00:00Z",
}];

export function productHost(
  overrides: Partial<ModuleSurfaceHostContext> = {},
): ModuleSurfaceHostContext {
  return {
    token: "test-token",
    currentUserRole: "ops_manager",
    appearance: "system",
    moduleRows: [productModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

export const productModuleRow = {
  name: "product.master",
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
