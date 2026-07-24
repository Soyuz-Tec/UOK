import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import { vi } from "vitest";

import type {
  ShipmentReadinessResponse,
  ShipmentReadinessSignal,
} from "../../web/src/types";

export const attentionSignal: ShipmentReadinessSignal = {
  shipment_id: "shipment-attention",
  code: "RCN-AFRICA-VOC-001",
  lifecycle_status: "in_transit",
  open_path: "/?view=shipments&shipment_id=shipment-attention",
  band: "attention_required",
  reason_codes: [
    "required_documents_missing",
    "rejected_document_present",
    "document_metadata_pending_review",
  ],
  status_summary: "Required evidence needs operator attention.",
  required_total: 3,
  required_satisfied: 2,
  required_missing: 1,
  required_received: 1,
  required_waived: 1,
  required_not_applicable: 0,
  optional_total: 1,
  document_instance_total: 3,
  document_instance_draft: 1,
  document_instance_recorded: 0,
  document_instance_verified: 1,
  document_instance_rejected: 1,
  document_instance_superseded: 0,
};

export const readySignal: ShipmentReadinessSignal = {
  ...attentionSignal,
  shipment_id: "shipment-ready",
  code: "RCN-AFRICA-VOC-READY",
  lifecycle_status: "planned",
  open_path: "/?view=shipments&shipment_id=shipment-ready",
  band: "ready",
  reason_codes: [
    "required_documents_satisfied",
    "verified_document_present",
  ],
  status_summary: "All required document types are satisfied.",
  required_missing: 0,
  required_satisfied: 3,
  required_received: 2,
  document_instance_draft: 0,
  document_instance_rejected: 0,
  document_instance_verified: 3,
};

export const notAssessedSignal: ShipmentReadinessSignal = {
  ...attentionSignal,
  shipment_id: "shipment-not-assessed",
  code: "RCN-UNASSESSED-001",
  lifecycle_status: "draft",
  open_path: null,
  band: "not_assessed",
  reason_codes: ["requirements_not_defined"],
  status_summary: "Required document types have not been defined.",
  required_total: 0,
  required_satisfied: 0,
  required_missing: 0,
  required_received: 0,
  required_waived: 0,
  optional_total: 0,
  document_instance_total: 0,
  document_instance_draft: 0,
  document_instance_verified: 0,
  document_instance_rejected: 0,
};

export const readinessResponse: ShipmentReadinessResponse = {
  source_status: "ready",
  source_summary: "Shipment readiness source is available.",
  items: [attentionSignal, readySignal, notAssessedSignal],
};

export const intelligenceModuleRow = {
  name: "intelligence.core",
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
  dependencies: ["shipments.core"],
  dependents: [],
};

export function intelligenceHost(
  overrides: Partial<ModuleSurfaceHostContext> = {},
): ModuleSurfaceHostContext {
  return {
    token: "test-token",
    currentUserRole: "viewer",
    appearance: "system",
    moduleRows: [intelligenceModuleRow],
    busyAction: "",
    moduleAction: vi.fn(),
    refreshHost: vi.fn().mockResolvedValue(undefined),
    moduleRefreshRevision: 0,
    onUnauthorized: vi.fn(),
    ...overrides,
  };
}

export function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function readinessFetchMock(
  response: () => ShipmentReadinessResponse = () => readinessResponse,
) {
  return vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    if (
      String(input) !== "/api/intelligence/shipment-readiness"
      || options?.method !== "GET"
    ) {
      return jsonResponse({ detail: "not found" }, 404);
    }
    return jsonResponse(response());
  });
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}
