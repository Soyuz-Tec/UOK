import type {
  ShipmentDocumentRequirementList,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";
import type {
  ShipmentDocumentInstance,
  ShipmentDocumentInstanceMetadataDraft,
  ShipmentDocumentInstanceStatusDraft,
} from "./shipmentDocumentInstanceTypes";

type UnauthorizedHandler = () => void;

export function loadShipmentDocumentInstances(
  token: string,
  shipmentId: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return shipmentInstanceJson<ShipmentDocumentInstance[]>(
    token,
    `/api/shipments/records/${encodeURIComponent(shipmentId)}/document-instances`,
    onUnauthorized,
  );
}

export function loadInstanceRequirementOptions(
  token: string,
  shipmentId: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return shipmentInstanceJson<ShipmentDocumentRequirementList>(
    token,
    `/api/shipments/records/${encodeURIComponent(shipmentId)}/document-requirements`,
    onUnauthorized,
  );
}

export function loadInstanceDocumentTypeOptions(
  token: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return shipmentInstanceJson<ShipmentDocumentTypeReference[]>(
    token,
    "/api/shipments/document-type-options",
    onUnauthorized,
  );
}

export function createShipmentDocumentInstance(
  token: string,
  shipmentId: string,
  draft: ShipmentDocumentInstanceMetadataDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return instanceCommand(token, "CreateShipmentDocumentInstance", {
    shipment_id: shipmentId,
    compliance_document_type_id: draft.complianceDocumentTypeId,
    requirement_id: optionalValue(draft.requirementId),
    document_number: draft.documentNumber.trim(),
    issuing_party_name: optionalValue(draft.issuingPartyName),
    issued_on: optionalValue(draft.issuedOn),
    expires_on: optionalValue(draft.expiresOn),
    notes: optionalValue(draft.notes),
  }, "shipment-document-instance-create", onUnauthorized);
}

export function updateShipmentDocumentInstance(
  token: string,
  instance: ShipmentDocumentInstance,
  draft: ShipmentDocumentInstanceMetadataDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return instanceCommand(token, "UpdateShipmentDocumentInstance", {
    shipment_id: instance.shipment_id,
    instance_id: instance.id,
    expected_version: instance.version,
    document_number: draft.documentNumber.trim(),
    issuing_party_name: optionalValue(draft.issuingPartyName),
    issued_on: optionalValue(draft.issuedOn),
    expires_on: optionalValue(draft.expiresOn),
    notes: optionalValue(draft.notes),
    reason: draft.reason.trim(),
  }, "shipment-document-instance-update", onUnauthorized);
}

export function setShipmentDocumentInstanceStatus(
  token: string,
  instance: ShipmentDocumentInstance,
  draft: ShipmentDocumentInstanceStatusDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return instanceCommand(token, "SetShipmentDocumentInstanceStatus", {
    shipment_id: instance.shipment_id,
    instance_id: instance.id,
    expected_version: instance.version,
    new_status: draft.newStatus,
    reason: draft.reason.trim(),
    mark_requirement_received: draft.markRequirementReceived,
    expected_requirement_version: draft.markRequirementReceived
      ? instance.requirement?.version
      : null,
  }, "shipment-document-instance-status", onUnauthorized);
}

async function instanceCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await shipmentInstanceJson<{ result: ShipmentDocumentInstance }>(
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

async function shipmentInstanceJson<T>(
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
    throw new Error(instanceError(body, response.status));
  }
  return body as T;
}

function optionalValue(value: string) {
  return value.trim() || null;
}

function instanceError(body: unknown, status: number) {
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
  return `Shipment document instances request failed with HTTP ${status}.`;
}
