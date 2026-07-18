import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementDraft,
  ShipmentDocumentRequirementEditorMode,
  ShipmentDocumentRequirementStatus,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";
import { emptyRequirementDraft } from "./shipmentDocumentRequirementTypes";

export const requirementStatuses: ShipmentDocumentRequirementStatus[] = [
  "missing",
  "received",
  "waived",
  "not_applicable",
];

export function initialRequirementDraft(
  mode: ShipmentDocumentRequirementEditorMode,
  target: ShipmentDocumentRequirement | null,
): ShipmentDocumentRequirementDraft {
  if (mode === "add" || !target) return { ...emptyRequirementDraft };
  return {
    complianceDocumentTypeId: target.compliance_document_type_id || "",
    requirementLevel: target.requirement_level,
    notes: target.notes || "",
    newStatus: "",
    reason: "",
  };
}

export function validateRequirementDraft(
  mode: ShipmentDocumentRequirementEditorMode,
  target: ShipmentDocumentRequirement | null,
  draft: ShipmentDocumentRequirementDraft,
) {
  if (mode === "add" && !draft.complianceDocumentTypeId) {
    return "Choose an active Compliance document type.";
  }
  if (mode === "edit" && target
    && draft.requirementLevel === target.requirement_level
    && draft.notes.trim() === (target.notes || "")) {
    return "Change the requirement level or notes.";
  }
  if (mode === "status" && !draft.newStatus) return "Choose a different status.";
  if (mode !== "add" && !draft.reason.trim()) return "A reason is required.";
  return "";
}

export function documentTypeLabel(reference: ShipmentDocumentTypeReference) {
  return [reference.code, reference.canonical_name].filter(Boolean).join(" · ")
    || (reference.status === "denied"
      ? "Restricted document type"
      : "Document type unavailable");
}

export function requirementEditorLabel(mode: ShipmentDocumentRequirementEditorMode) {
  return `${requirementSubmitLabel(mode)} form`;
}

export function requirementSubmitLabel(mode: ShipmentDocumentRequirementEditorMode) {
  return ({
    add: "Add requirement",
    edit: "Save requirement",
    status: "Update status",
    remove: "Remove requirement",
  })[mode];
}

export function requirementStatusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
