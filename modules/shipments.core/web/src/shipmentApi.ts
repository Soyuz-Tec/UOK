import type {
  LocationReference,
  PartyReference,
  RoutePathReference,
  Shipment,
  ShipmentDraft,
  ShipmentStatus,
  ShipmentStatusHistory,
} from "./types";

type UnauthorizedHandler = () => void;
type ShipmentCommandResult = Shipment & { correlation_id: string };

export function loadShipments(token: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<Shipment[]>(token, "/api/shipments/records", onUnauthorized);
}

export function loadShipment(token: string, shipmentId: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<Shipment>(token, `/api/shipments/records/${encodeURIComponent(shipmentId)}`, onUnauthorized);
}

export function loadShipmentStatusHistory(token: string, shipmentId: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<ShipmentStatusHistory[]>(
    token,
    `/api/shipments/records/${encodeURIComponent(shipmentId)}/status-history`,
    onUnauthorized,
  );
}

export function loadLocationOptions(token: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<LocationReference[]>(token, "/api/shipments/location-options", onUnauthorized);
}

export function loadRouteOptions(token: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<RoutePathReference[]>(token, "/api/shipments/route-options", onUnauthorized);
}

export function resolvePartyReference(token: string, partyId: string, onUnauthorized: UnauthorizedHandler) {
  return shipmentJson<PartyReference>(
    token,
    `/api/shipments/party-references/${encodeURIComponent(partyId.trim())}`,
    onUnauthorized,
  );
}

export function createShipment(token: string, draft: ShipmentDraft, onUnauthorized: UnauthorizedHandler) {
  return shipmentCommand(token, "CreateShipment", shipmentPayload(draft), "shipment-create", onUnauthorized);
}

export function updateShipment(
  token: string,
  shipment: Shipment,
  draft: ShipmentDraft,
  onUnauthorized: UnauthorizedHandler,
) {
  return shipmentCommand(token, "UpdateShipment", {
    shipment_id: shipment.id,
    expected_version: shipment.version,
    shipper_party_id: draft.shipperPartyId.trim(),
    consignee_party_id: draft.consigneePartyId.trim(),
    origin_location_id: draft.originLocationId,
    destination_location_id: draft.destinationLocationId,
    route_definition_id: draft.routeDefinitionId || null,
    planned_departure_on: draft.plannedDepartureOn || null,
    planned_arrival_on: draft.plannedArrivalOn || null,
  }, "shipment-update", onUnauthorized);
}

export function transitionShipmentStatus(
  token: string,
  shipment: Shipment,
  newStatus: ShipmentStatus,
  reason: string,
  onUnauthorized: UnauthorizedHandler,
) {
  return shipmentCommand(token, "TransitionShipmentStatus", {
    shipment_id: shipment.id,
    expected_version: shipment.version,
    new_status: newStatus,
    reason: reason.trim(),
  }, "shipment-status", onUnauthorized);
}

function shipmentPayload(draft: ShipmentDraft) {
  return {
    code: draft.code.trim(),
    shipper_party_id: draft.shipperPartyId.trim(),
    consignee_party_id: draft.consigneePartyId.trim(),
    origin_location_id: draft.originLocationId,
    destination_location_id: draft.destinationLocationId,
    route_definition_id: draft.routeDefinitionId || null,
    planned_departure_on: draft.plannedDepartureOn || null,
    planned_arrival_on: draft.plannedArrivalOn || null,
  };
}

async function shipmentCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string,
  onUnauthorized: UnauthorizedHandler,
) {
  const response = await shipmentJson<{ result: ShipmentCommandResult }>(token, "/api/commands", onUnauthorized, {
    method: "POST",
    body: JSON.stringify({
      command_type: commandType,
      payload,
      idempotency_key: `${idempotencyPrefix}:${crypto.randomUUID()}`,
    }),
  });
  return response.result;
}

async function shipmentJson<T>(
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
    throw new Error(shipmentErrorMessage(body, response.status));
  }
  return body as T;
}

function shipmentErrorMessage(body: unknown, status: number) {
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
  return `Shipment Support request failed with HTTP ${status}.`;
}
