import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import type { ComplianceMutationAction, ComplianceMutationEffect, ComplianceMutationInteraction } from "./complianceMutationAuthority";
import type { ComplianceCommandRequest } from "./complianceApi";
import type { ComplianceDocumentType } from "./types";
import type {
  ComplianceReconciliationRequest,
  ComplianceReconciliationResult,
} from "./useComplianceDocumentTypeReconciliation";

export type ComplianceMutationOutcome =
  | { kind: "success"; documentType: ComplianceDocumentType }
  | { kind: "error"; error: unknown };

export type ComplianceMutationOperation = {
  id: number;
  action: ComplianceMutationAction;
  effect: ComplianceMutationEffect | null;
  outcome: ComplianceMutationOutcome | null;
  reconciling: boolean;
  execute: (request: ComplianceCommandRequest) => Promise<ComplianceDocumentType>;
  onSuccess: (documentType: ComplianceDocumentType | null) => void;
  onError: (error: unknown) => void;
  onPending: (error?: unknown) => void;
};

export type ComplianceMutationRunInput = {
  action: ComplianceMutationAction;
  target?: { id: string; version: number };
  execute: ComplianceMutationOperation["execute"];
  onSuccess: ComplianceMutationOperation["onSuccess"];
  onError: ComplianceMutationOperation["onError"];
  onPending: ComplianceMutationOperation["onPending"];
};

export type ComplianceMutationCoordinatorOptions = {
  host: ModuleSurfaceRenderContext;
  operational: boolean;
  canManage: boolean;
  interactionRef: { current: ComplianceMutationInteraction };
  reconcileDocumentTypes: (
    request?: ComplianceReconciliationRequest,
  ) => Promise<ComplianceReconciliationResult>;
  supersedeReadsForMutation: () => void;
};
