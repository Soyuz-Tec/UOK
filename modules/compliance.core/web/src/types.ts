export type ComplianceDocumentTypeStatus = "active" | "inactive" | "archived";
export type ComplianceDocumentTypeStatusFilter =
  | "current"
  | "all"
  | ComplianceDocumentTypeStatus;
export type ComplianceDocumentTypeSort = "code" | "name" | "category";
export type ComplianceDocumentTypeSortDirection = "asc" | "desc";
export type ComplianceDocumentTypeLifecycleAction =
  | "deactivate"
  | "activate"
  | "archive"
  | "restore";

export type ComplianceDocumentType = {
  id: string;
  code: string;
  canonical_name: string;
  description: string | null;
  category: string | null;
  status: ComplianceDocumentTypeStatus;
  version: number;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type ComplianceDocumentTypeNameHistory = {
  id: string;
  compliance_document_type_id: string;
  previous_name: string;
  new_name: string;
  reason: string;
  changed_by_user_id: string;
  changed_at: string;
};

export type ComplianceDocumentTypeDraft = {
  code: string;
  canonicalName: string;
  description: string;
  category: string;
  reason: string;
};

export const emptyComplianceDocumentTypeDraft: ComplianceDocumentTypeDraft = {
  code: "",
  canonicalName: "",
  description: "",
  category: "",
  reason: "",
};

export function draftFromComplianceDocumentType(
  documentType: ComplianceDocumentType,
): ComplianceDocumentTypeDraft {
  return {
    code: documentType.code,
    canonicalName: documentType.canonical_name,
    description: documentType.description || "",
    category: documentType.category || "",
    reason: "",
  };
}
