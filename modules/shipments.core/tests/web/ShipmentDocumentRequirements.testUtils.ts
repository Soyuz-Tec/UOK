import { vi } from "vitest";

import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementList,
  ShipmentDocumentTypeReference,
} from "../../web/src/shipmentDocumentRequirementTypes";

export const shipmentId = "shipment-1";

export const billOfLadingType: ShipmentDocumentTypeReference = {
  compliance_document_type_id: "document-type-bol",
  status: "ready",
  code: "BILL-OF-LADING",
  canonical_name: "Bill of Lading",
  category: "transport",
  lifecycle_status: "active",
  status_summary: "Compliance document type is active.",
};

export const certificateType: ShipmentDocumentTypeReference = {
  compliance_document_type_id: "document-type-coo",
  status: "ready",
  code: "CERTIFICATE-OF-ORIGIN",
  canonical_name: "Certificate of Origin",
  category: "origin",
  lifecycle_status: "active",
  status_summary: "Compliance document type is active.",
};

export const billOfLadingRequirement: ShipmentDocumentRequirement = {
  id: "requirement-bol",
  shipment_id: shipmentId,
  compliance_document_type_id: billOfLadingType.compliance_document_type_id,
  requirement_level: "required",
  status: "missing",
  notes: "Original negotiable set",
  version: 1,
  created_by_user_id: "user-1",
  updated_by_user_id: "user-1",
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T10:00:00Z",
  document_type: billOfLadingType,
};

export function requirementList(
  items: ShipmentDocumentRequirement[],
): ShipmentDocumentRequirementList {
  const required = items.filter((item) => item.requirement_level === "required");
  const count = (status: ShipmentDocumentRequirement["status"]) => (
    required.filter((item) => item.status === status).length
  );
  return {
    items,
    summary: {
      required_total: required.length,
      required_satisfied: required.filter((item) => (
        ["received", "waived", "not_applicable"].includes(item.status)
      )).length,
      required_missing: count("missing"),
      required_received: count("received"),
      required_waived: count("waived"),
      required_not_applicable: count("not_applicable"),
      optional_total: items.length - required.length,
    },
  };
}

export function requirementPanelProps(overrides: Record<string, unknown> = {}) {
  return {
    token: "tenant-a-token",
    shipmentId,
    canManage: true,
    onUnauthorized: vi.fn(),
    onStatus: vi.fn(),
    ...overrides,
  };
}

export function jsonResponse(value: unknown, status = 200) {
  return new Response(
    JSON.stringify(value),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export function requirementFetchMock({
  current,
  command,
}: {
  current: () => ShipmentDocumentRequirementList;
  command?: (body: Record<string, unknown>) => unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const path = String(input);
    if (path === "/api/commands") {
      const body = JSON.parse(String(request?.body));
      return jsonResponse({
        result: command?.(body) || { ...billOfLadingRequirement, correlation_id: "corr-1" },
      });
    }
    if (path === "/api/shipments/document-type-options") {
      return jsonResponse([billOfLadingType, certificateType]);
    }
    if (path.endsWith("/document-requirements")) return jsonResponse(current());
    return jsonResponse({ detail: "not found" }, 404);
  });
}
