import type { ShipmentDocumentInstanceEditorMode } from "./shipmentDocumentInstanceTypes";

export function isCurrentInstanceRequest(
  mountedRef: { current: boolean },
  sessionRef: { current: string },
  requestRef: { current: number },
  key: string,
  request: number,
) {
  return mountedRef.current
    && sessionRef.current === key
    && requestRef.current === request;
}

export function instanceMutationSuccess(mode: ShipmentDocumentInstanceEditorMode) {
  return ({
    create: "Created shipment document instance.",
    edit: "Updated shipment document instance metadata.",
    status: "Updated shipment document instance status.",
  })[mode];
}

export function instanceMutationError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment document instance command failed.";
}
