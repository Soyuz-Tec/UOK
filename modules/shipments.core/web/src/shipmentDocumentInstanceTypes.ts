import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";

export type ShipmentDocumentInstanceStatus =
  | "draft"
  | "recorded"
  | "verified"
  | "rejected"
  | "superseded";

export type ShipmentDocumentInstanceRequirement = Pick<
  ShipmentDocumentRequirement,
  "id" | "requirement_level" | "status" | "version"
>;

export type ShipmentDocumentInstance = {
  id: string;
  shipment_id: string;
  compliance_document_type_id: string | null;
  requirement_id: string | null;
  document_number: string;
  issuing_party_name: string | null;
  issued_on: string | null;
  expires_on: string | null;
  status: ShipmentDocumentInstanceStatus;
  notes: string | null;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  document_type: ShipmentDocumentTypeReference;
  requirement: ShipmentDocumentInstanceRequirement | null;
};

export type ShipmentDocumentInstanceMetadataDraft = {
  complianceDocumentTypeId: string;
  requirementId: string;
  documentNumber: string;
  issuingPartyName: string;
  issuedOn: string;
  expiresOn: string;
  notes: string;
  reason: string;
};

export type ShipmentDocumentInstanceStatusDraft = {
  newStatus: ShipmentDocumentInstanceStatus | "";
  reason: string;
  markRequirementReceived: boolean;
};

export type ShipmentDocumentInstanceEditorMode = "create" | "edit" | "status";

export const emptyInstanceMetadataDraft: ShipmentDocumentInstanceMetadataDraft = {
  complianceDocumentTypeId: "",
  requirementId: "",
  documentNumber: "",
  issuingPartyName: "",
  issuedOn: "",
  expiresOn: "",
  notes: "",
  reason: "",
};

export const emptyInstanceStatusDraft: ShipmentDocumentInstanceStatusDraft = {
  newStatus: "",
  reason: "",
  markRequirementReceived: false,
};
