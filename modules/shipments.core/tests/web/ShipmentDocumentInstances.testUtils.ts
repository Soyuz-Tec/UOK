import { vi } from "vitest";

import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementList,
  ShipmentDocumentTypeReference,
} from "../../web/src/shipmentDocumentRequirementTypes";
import type { ShipmentDocumentInstance } from "../../web/src/shipmentDocumentInstanceTypes";

export const instanceShipmentId = "shipment-1";

export const invoiceType: ShipmentDocumentTypeReference = {
  compliance_document_type_id: "document-type-invoice",
  status: "ready",
  code: "COMMERCIAL-INVOICE",
  canonical_name: "Commercial Invoice",
  category: "commercial",
  lifecycle_status: "active",
  status_summary: "Compliance document type is active.",
};

export const invoiceRequirement: ShipmentDocumentRequirement = {
  id: "requirement-invoice",
  shipment_id: instanceShipmentId,
  compliance_document_type_id: invoiceType.compliance_document_type_id,
  requirement_level: "required",
  status: "missing",
  notes: "Original required",
  version: 4,
  created_by_user_id: "ops-1",
  updated_by_user_id: "ops-1",
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T10:00:00Z",
  document_type: invoiceType,
};

export const invoiceInstance: ShipmentDocumentInstance = {
  id: "instance-invoice",
  shipment_id: instanceShipmentId,
  compliance_document_type_id: invoiceType.compliance_document_type_id,
  requirement_id: invoiceRequirement.id,
  document_number: "INV-2026-0042",
  issuing_party_name: "Kayilan Export Partner",
  issued_on: "2026-07-10",
  expires_on: "2026-10-10",
  status: "recorded",
  notes: "Commercial invoice metadata",
  version: 3,
  created_by_user_id: "ops-1",
  updated_by_user_id: "ops-1",
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T12:00:00Z",
  document_type: invoiceType,
  requirement: {
    id: invoiceRequirement.id,
    requirement_level: "required",
    status: "missing",
    version: invoiceRequirement.version,
  },
};

export function instancePanelProps(overrides: Record<string, unknown> = {}) {
  return {
    token: "tenant-token",
    shipmentId: instanceShipmentId,
    canManage: true,
    onUnauthorized: vi.fn(),
    onStatus: vi.fn(),
    onRequirementChanged: vi.fn(),
    ...overrides,
  };
}

export function requirementResponse(
  items: ShipmentDocumentRequirement[],
): ShipmentDocumentRequirementList {
  const required = items.filter((item) => item.requirement_level === "required");
  return {
    items,
    summary: {
      required_total: required.length,
      required_satisfied: required.filter((item) => (
        item.status === "received" || item.status === "waived"
      )).length,
      required_missing: required.filter((item) => item.status === "missing").length,
      required_received: required.filter((item) => item.status === "received").length,
      required_waived: required.filter((item) => item.status === "waived").length,
      required_not_applicable: required.filter((item) => (
        item.status === "not_applicable"
      )).length,
      optional_total: items.filter((item) => item.requirement_level === "optional").length,
    },
  };
}

export function instanceFetchMock({
  instances,
  requirements = () => requirementResponse([invoiceRequirement]),
  types = () => [invoiceType],
  command = () => invoiceInstance,
}: {
  instances: () => ShipmentDocumentInstance[];
  requirements?: () => ShipmentDocumentRequirementList;
  types?: () => ShipmentDocumentTypeReference[];
  command?: (body: Record<string, unknown>) => unknown;
}) {
  return vi.fn(async (input: RequestInfo | URL, request?: RequestInit) => {
    const path = String(input);
    if (path === "/api/commands") {
      const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
      return jsonResponse({ result: command(body) });
    }
    if (path.endsWith("/document-instances")) return jsonResponse(instances());
    if (path.endsWith("/document-requirements")) return jsonResponse(requirements());
    if (path.endsWith("/document-type-options")) return jsonResponse(types());
    return jsonResponse({ detail: `Unexpected request: ${path}` }, 500);
  });
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
