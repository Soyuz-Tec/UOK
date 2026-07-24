import { documentTypeLabel } from "./shipmentDocumentRequirementDisplay";
import type { ShipmentDocumentRequirement } from "./shipmentDocumentRequirementTypes";
import {
  emptyInstanceMetadataDraft,
  type ShipmentDocumentInstance,
  type ShipmentDocumentInstanceEditorMode,
  type ShipmentDocumentInstanceMetadataDraft,
  type ShipmentDocumentInstanceStatus,
} from "./shipmentDocumentInstanceTypes";

const transitions: Record<
  ShipmentDocumentInstanceStatus,
  ShipmentDocumentInstanceStatus[]
> = {
  draft: ["recorded", "superseded"],
  recorded: ["verified", "rejected", "superseded"],
  rejected: ["recorded", "superseded"],
  verified: ["superseded"],
  superseded: [],
};

export function instanceTransitions(status: ShipmentDocumentInstanceStatus) {
  return transitions[status];
}

export function instanceCanEdit(status: ShipmentDocumentInstanceStatus) {
  return status === "draft" || status === "recorded" || status === "rejected";
}

export function initialInstanceMetadataDraft(
  target: ShipmentDocumentInstance | null,
): ShipmentDocumentInstanceMetadataDraft {
  if (!target) return { ...emptyInstanceMetadataDraft };
  return {
    complianceDocumentTypeId: target.compliance_document_type_id || "",
    requirementId: target.requirement_id || "",
    documentNumber: target.document_number,
    issuingPartyName: target.issuing_party_name || "",
    issuedOn: target.issued_on || "",
    expiresOn: target.expires_on || "",
    notes: target.notes || "",
    reason: "",
  };
}

export function validateInstanceMetadata(
  mode: Exclude<ShipmentDocumentInstanceEditorMode, "status">,
  target: ShipmentDocumentInstance | null,
  draft: ShipmentDocumentInstanceMetadataDraft,
) {
  if (mode === "create" && !draft.complianceDocumentTypeId) {
    return "Choose an active Compliance document type.";
  }
  if (!draft.documentNumber.trim()) return "Document number is required.";
  if (draft.issuedOn && draft.expiresOn && draft.expiresOn < draft.issuedOn) {
    return "Expiry date cannot be before issue date.";
  }
  if (mode === "edit" && !draft.reason.trim()) return "A change reason is required.";
  if (mode === "edit" && target && !metadataChanged(target, draft)) {
    return "Change at least one metadata field.";
  }
  return "";
}

export function matchingRequirementOptions(
  requirements: ShipmentDocumentRequirement[],
  complianceDocumentTypeId: string,
) {
  return requirements.filter((requirement) => (
    !complianceDocumentTypeId
    || requirement.compliance_document_type_id === complianceDocumentTypeId
  ));
}

export function instanceDocumentTypeLabel(instance: ShipmentDocumentInstance) {
  return documentTypeLabel(instance.document_type);
}

export function instanceStatusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function instanceEditorTitle(mode: ShipmentDocumentInstanceEditorMode) {
  return ({
    create: "Create document instance",
    edit: "Edit document instance",
    status: "Change document instance status",
  })[mode];
}

function metadataChanged(
  target: ShipmentDocumentInstance,
  draft: ShipmentDocumentInstanceMetadataDraft,
) {
  return draft.documentNumber.trim() !== target.document_number
    || optionalValue(draft.issuingPartyName) !== target.issuing_party_name
    || optionalValue(draft.issuedOn) !== target.issued_on
    || optionalValue(draft.expiresOn) !== target.expires_on
    || optionalValue(draft.notes) !== target.notes;
}

function optionalValue(value: string) {
  return value.trim() || null;
}
