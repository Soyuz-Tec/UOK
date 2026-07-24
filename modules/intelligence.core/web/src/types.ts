export type ShipmentReadinessBand =
  | "attention_required"
  | "not_assessed"
  | "ready";

export type ShipmentReadinessReasonCode =
  | "required_documents_missing"
  | "rejected_document_present"
  | "expired_document_present"
  | "expiring_document_present"
  | "document_expiry_not_recorded"
  | "requirements_not_defined"
  | "required_documents_satisfied"
  | "document_metadata_pending_review"
  | "verified_document_present";

export type ShipmentReadinessSignal = {
  shipment_id: string;
  code: string;
  lifecycle_status: string;
  open_path: string | null;
  band: ShipmentReadinessBand;
  reason_codes: ShipmentReadinessReasonCode[];
  status_summary: string;
  required_total: number;
  required_satisfied: number;
  required_missing: number;
  required_received: number;
  required_waived: number;
  required_not_applicable: number;
  optional_total: number;
  document_instance_total: number;
  document_instance_draft: number;
  document_instance_recorded: number;
  document_instance_verified: number;
  document_instance_rejected: number;
  document_instance_superseded: number;
  document_instance_expiry_evaluated: number;
  document_instance_expiry_not_recorded: number;
  document_instance_expired: number;
  document_instance_expiring_soon: number;
  next_document_expiry_on: string | null;
};

export type ShipmentReadinessResponse = {
  source_status: "ready";
  source_summary: string;
  as_of: string;
  evaluation_timezone: "UTC";
  expiring_soon_horizon_days: 30;
  expiring_soon_through: string;
  items: ShipmentReadinessSignal[];
};

export type ShipmentReadinessEvaluationMetadata = Pick<
  ShipmentReadinessResponse,
  | "as_of"
  | "evaluation_timezone"
  | "expiring_soon_horizon_days"
  | "expiring_soon_through"
>;

export type ShipmentReadinessBandFilter = "all" | ShipmentReadinessBand;
