import type {
  ShipmentDocumentRequirementEditorMode,
} from "./shipmentDocumentRequirementTypes";

export function requirementMutationSuccess(
  mode: ShipmentDocumentRequirementEditorMode,
) {
  return ({
    add: "Added shipment document requirement.",
    edit: "Updated shipment document requirement.",
    status: "Updated shipment document requirement status.",
    remove: "Removed shipment document requirement.",
  })[mode];
}

export function requirementMutationError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment document requirement command failed.";
}
