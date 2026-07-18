import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementDraft,
  ShipmentDocumentRequirementList,
  ShipmentDocumentRequirementStatus,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";

type UnauthorizedHandler = () => void;

export function loadShipmentDocumentRequirements(
  token: string,
  shipmentId: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementJson<ShipmentDocumentRequirementList>(
    token,
    `/api/shipments/records/${encodeURIComponent(shipmentId)}/document-requirements`,
    onUnauthorized,
  );
}

export function loadShipmentDocumentTypeOptions(
  token: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementJson<ShipmentDocumentTypeReference[]>(
    token,
    "/api/shipments/document-type-options",
    onUnauthorized,
  );
}

export function addShipmentDocumentRequirement(
  token: string,
  shipmentId: string,
  draft: ShipmentDocumentRequirementDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementCommand(token, "AddShipmentDocumentRequirement", {
    shipment_id: shipmentId,
    compliance_document_type_id: draft.complianceDocumentTypeId,
    requirement_level: draft.requirementLevel,
    notes: optionalValue(draft.notes),
  }, "shipment-document-requirement-add", onUnauthorized);
}

export function updateShipmentDocumentRequirement(
  token: string,
  requirement: ShipmentDocumentRequirement,
  draft: ShipmentDocumentRequirementDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementCommand(token, "UpdateShipmentDocumentRequirement", {
    shipment_id: requirement.shipment_id,
    requirement_id: requirement.id,
    expected_version: requirement.version,
    requirement_level: draft.requirementLevel,
    notes: optionalValue(draft.notes),
    reason: draft.reason.trim(),
  }, "shipment-document-requirement-update", onUnauthorized);
}

export function setShipmentDocumentRequirementStatus(
  token: string,
  requirement: ShipmentDocumentRequirement,
  status: ShipmentDocumentRequirementStatus,
  reason: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementCommand(token, "SetShipmentDocumentRequirementStatus", {
    shipment_id: requirement.shipment_id,
    requirement_id: requirement.id,
    expected_version: requirement.version,
    new_status: status,
    reason: reason.trim(),
  }, "shipment-document-requirement-status", onUnauthorized);
}

export function removeShipmentDocumentRequirement(
  token: string,
  requirement: ShipmentDocumentRequirement,
  reason: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return requirementCommand(token, "RemoveShipmentDocumentRequirement", {
    shipment_id: requirement.shipment_id,
    requirement_id: requirement.id,
    expected_version: requirement.version,
    reason: reason.trim(),
  }, "shipment-document-requirement-remove", onUnauthorized);
}

async function requirementCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await requirementJson<{ result: unknown }>(
    token,
    "/api/commands",
    onUnauthorized,
    {
      method: "POST",
      body: JSON.stringify({
        command_type: commandType,
        payload,
        idempotency_key: `${idempotencyPrefix}:${crypto.randomUUID()}`,
      }),
    },
  );
  return response.result;
}

async function requirementJson<T>(
  token: string,
  path: string,
  onUnauthorized: UnauthorizedHandler,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw new Error(requirementError(body, response.status));
  }
  return body as T;
}

function optionalValue(value: string) {
  return value.trim() || null;
}

function requirementError(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === "string") return record.detail;
    for (const candidate of [record.detail, record.error]) {
      if (candidate && typeof candidate === "object") {
        const detail = candidate as Record<string, unknown>;
        if (typeof detail.message === "string") return detail.message;
        if (typeof detail.error === "string") return detail.error;
      }
    }
  }
  return `Shipment document requirements request failed with HTTP ${status}.`;
}
