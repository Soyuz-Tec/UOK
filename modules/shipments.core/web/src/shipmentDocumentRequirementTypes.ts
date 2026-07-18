import type { ReferenceStatus } from "./types";

export type ShipmentDocumentRequirementLevel = "required" | "optional";
export type ShipmentDocumentRequirementStatus =
  | "missing"
  | "received"
  | "waived"
  | "not_applicable";

export type ShipmentDocumentTypeReference = {
  compliance_document_type_id: string | null;
  status: ReferenceStatus;
  code: string | null;
  canonical_name: string | null;
  category: string | null;
  lifecycle_status: string | null;
  status_summary: string;
};

export type ShipmentDocumentRequirement = {
  id: string;
  shipment_id: string;
  compliance_document_type_id: string | null;
  requirement_level: ShipmentDocumentRequirementLevel;
  status: ShipmentDocumentRequirementStatus;
  notes: string | null;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  document_type: ShipmentDocumentTypeReference;
};

export type ShipmentDocumentRequirementSummary = {
  required_total: number;
  required_satisfied: number;
  required_missing: number;
  required_received: number;
  required_waived: number;
  required_not_applicable: number;
  optional_total: number;
};

export type ShipmentDocumentRequirementList = {
  items: ShipmentDocumentRequirement[];
  summary: ShipmentDocumentRequirementSummary;
};

export type ShipmentDocumentRequirementDraft = {
  complianceDocumentTypeId: string;
  requirementLevel: ShipmentDocumentRequirementLevel;
  notes: string;
  newStatus: ShipmentDocumentRequirementStatus | "";
  reason: string;
};

export type ShipmentDocumentRequirementEditorMode =
  | "add"
  | "edit"
  | "status"
  | "remove";

export const emptyRequirementSummary: ShipmentDocumentRequirementSummary = {
  required_total: 0,
  required_satisfied: 0,
  required_missing: 0,
  required_received: 0,
  required_waived: 0,
  required_not_applicable: 0,
  optional_total: 0,
};

export const emptyRequirementDraft: ShipmentDocumentRequirementDraft = {
  complianceDocumentTypeId: "",
  requirementLevel: "required",
  notes: "",
  newStatus: "",
  reason: "",
};
