import { useEffect, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import type { ComplianceMutationInteraction } from "./complianceMutationAuthority";
import {
  changeComplianceDocumentTypeLifecycle,
  createComplianceDocumentType,
  isComplianceApiError,
  updateComplianceDocumentType,
} from "./complianceApi";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeDraft,
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeStatusFilter,
} from "./types";
import type {
  ComplianceReconciliationRequest,
  ComplianceReconciliationResult,
} from "./useComplianceDocumentTypeReconciliation";
import { useComplianceDocumentTypeMutationCoordinator } from "./useComplianceDocumentTypeMutationCoordinator";

export type ComplianceEditorMode = "create" | "edit" | null;

export function useComplianceDocumentTypeMutations({
  host,
  operational,
  canManage,
  interactionRef,
  selected,
  reconcileDocumentTypes,
  supersedeReadsForMutation,
  setStatus,
  setStatusFilter,
}: {
  host: ModuleSurfaceRenderContext;
  operational: boolean;
  canManage: boolean;
  interactionRef: { current: ComplianceMutationInteraction };
  selected: ComplianceDocumentType | null;
  reconcileDocumentTypes: (
    request?: ComplianceReconciliationRequest,
  ) => Promise<ComplianceReconciliationResult>;
  supersedeReadsForMutation: () => void;
  setStatus: (value: string) => void;
  setStatusFilter: (value: ComplianceDocumentTypeStatusFilter) => void;
}) {
  const [editorMode, setEditorMode] = useState<ComplianceEditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const coordinator = useComplianceDocumentTypeMutationCoordinator({
    host,
    operational,
    canManage,
    interactionRef,
    reconcileDocumentTypes,
    supersedeReadsForMutation,
  });

  useEffect(() => {
    setEditorMode(null);
    setEditorError("");
  }, [
    canManage,
    host.currentUserRole,
    host.session.generation,
    host.session.token,
    host.surfaceActive,
    operational,
    selected?.id,
    selected?.version,
  ]);

  function openEditor(mode: Exclude<ComplianceEditorMode, null>) {
    if (
      coordinator.operationActive
      || !host.session.token
      || !canManage
      || !operational
      || !host.surfaceActive
      || (mode === "edit" && !selected)
    ) return;
    setEditorError("");
    setEditorMode(mode);
  }

  function closeEditor() {
    if (coordinator.operationActive) return;
    setEditorMode(null);
    setEditorError("");
  }

  async function saveDocumentType(
    mode: Exclude<ComplianceEditorMode, null>,
    draft: ComplianceDocumentTypeDraft,
  ) {
    const target = mode === "edit" ? selected : null;
    if (mode === "edit" && !target) return;
    const action = mode === "create" ? "create" : "update";
    await coordinator.runOperation({
      action,
      target: target ? { id: target.id, version: target.version } : undefined,
      execute: (request) => mode === "create"
        ? createComplianceDocumentType(host.session.token, draft, request)
        : updateComplianceDocumentType(host.session.token, target!, draft, request),
      onSuccess: (documentType) => {
        setEditorMode(null);
        setEditorError("");
        setStatus(successMessage(action, documentType));
      },
      onError: (error) => {
        const message = reconciledErrorMessage(error);
        setEditorError(message);
        setStatus(message);
      },
      onPending: () => {
        const message = pendingReconciliationMessage(action);
        setEditorError(message);
        setStatus(message);
      },
    });
  }

  async function runLifecycle(
    action: ComplianceDocumentTypeLifecycleAction,
    reason: string,
  ) {
    const target = selected;
    if (!target) return;
    await coordinator.runOperation({
      action,
      target: { id: target.id, version: target.version },
      execute: (request) => changeComplianceDocumentTypeLifecycle(
        host.session.token,
        target,
        action,
        reason,
        request,
      ),
      onSuccess: (documentType) => {
        setStatus(successMessage(action, documentType));
        setStatusFilter(lifecycleFilter[action]);
      },
      onError: (error) => setStatus(reconciledErrorMessage(error)),
      onPending: () => setStatus(pendingReconciliationMessage(action)),
    });
  }

  return {
    editorMode,
    editorError,
    ...coordinator,
    openEditor,
    closeEditor,
    saveDocumentType,
    runLifecycle,
  };
}

const lifecycleFilter: Record<
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeStatusFilter
> = {
  deactivate: "inactive",
  activate: "current",
  archive: "archived",
  restore: "current",
};

function actionLabel(action: string) {
  return (actionLabels[action] || "Changed");
}

const actionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  deactivate: "Deactivated",
  activate: "Activated",
  archive: "Archived",
  restore: "Restored",
};

function reconciledErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : "Compliance Document Types request failed.";
  const ambiguous = !isComplianceApiError(error) || error.ambiguous;
  return ambiguous
    ? `${message} The command outcome was uncertain; current server state was reloaded.`
    : `${message} Current server state was reloaded.`;
}

function pendingReconciliationMessage(action: string) {
  return `${actionLabel(action)} command outcome is unconfirmed; authoritative reconciliation is pending.`;
}

function successMessage(
  action: string,
  documentType: ComplianceDocumentType | null,
) {
  return documentType
    ? `${actionLabel(action)} ${documentType.canonical_name}.`
    : `${actionLabel(action)} document type; authoritative state was reloaded.`;
}
