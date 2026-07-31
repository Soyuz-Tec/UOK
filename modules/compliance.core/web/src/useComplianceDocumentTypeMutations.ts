import { useEffect, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import {
  changeComplianceDocumentTypeLifecycle,
  createComplianceDocumentType,
  updateComplianceDocumentType,
} from "./complianceApi";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeDraft,
  ComplianceDocumentTypeLifecycleAction,
  ComplianceDocumentTypeStatusFilter,
} from "./types";

export type ComplianceEditorMode = "create" | "edit" | null;

export function useComplianceDocumentTypeMutations({
  host,
  selected,
  applyDocumentType,
  invalidateRefresh,
  setStatus,
  setStatusFilter,
}: {
  host: ModuleSurfaceHostContext;
  selected: ComplianceDocumentType | null;
  applyDocumentType: (value: ComplianceDocumentType) => void;
  invalidateRefresh: () => void;
  setStatus: (value: string) => void;
  setStatusFilter: (value: ComplianceDocumentTypeStatusFilter) => void;
}) {
  const sessionToken = useRef(host.session.token);
  const mutationRequest = useRef(0);
  const activeOperation = useRef("");
  const [stateToken, setStateToken] = useState(host.session.token);
  const [editorMode, setEditorMode] = useState<ComplianceEditorMode>(null);
  const [editorError, setEditorError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  if (sessionToken.current !== host.session.token) {
    sessionToken.current = host.session.token;
    mutationRequest.current += 1;
    activeOperation.current = "";
  }
  const sessionMatches = stateToken === host.session.token;

  useEffect(() => {
    mutationRequest.current += 1;
    activeOperation.current = "";
    setStateToken(host.session.token);
    setEditorMode(null);
    setEditorError("");
    setBusyAction("");
  }, [host.session.token]);

  function openEditor(mode: Exclude<ComplianceEditorMode, null>) {
    if (mode === "edit" && !selected) return;
    setEditorError("");
    setEditorMode(mode);
  }

  function closeEditor() {
    if (activeOperation.current) return;
    setEditorMode(null);
    setEditorError("");
  }

  async function saveDocumentType(
    mode: Exclude<ComplianceEditorMode, null>,
    draft: ComplianceDocumentTypeDraft,
  ) {
    if (activeOperation.current || (mode === "edit" && !selected)) return;
    const action = mode === "create" ? "create" : "update";
    await runMutation(action, () => mode === "create"
      ? createComplianceDocumentType(host.session.token, draft, host.session.onUnauthorized)
      : updateComplianceDocumentType(
        host.session.token,
        selected!,
        draft,
        host.session.onUnauthorized,
      ));
  }

  async function runLifecycle(
    action: ComplianceDocumentTypeLifecycleAction,
    reason: string,
  ) {
    if (!selected || activeOperation.current) return;
    await runMutation(
      action,
      () => changeComplianceDocumentTypeLifecycle(
        host.session.token,
        selected,
        action,
        reason,
        host.session.onUnauthorized,
      ),
      lifecycleFilter[action],
    );
  }

  async function runMutation(
    action: string,
    operation: () => Promise<ComplianceDocumentType>,
    nextFilter?: ComplianceDocumentTypeStatusFilter,
  ) {
    const token = host.session.token;
    const request = ++mutationRequest.current;
    activeOperation.current = action;
    setBusyAction(action);
    setEditorError("");
    invalidateRefresh();
    try {
      const documentType = await operation();
      if (!isCurrent(sessionToken, mutationRequest, token, request)) return false;
      if (nextFilter) setStatusFilter(nextFilter);
      applyDocumentType(documentType);
      setEditorMode(null);
      setStatus(`${actionLabel(action)} ${documentType.canonical_name}.`);
      void host.refreshHost().catch(() => undefined);
      return true;
    } catch (error) {
      if (!isCurrent(sessionToken, mutationRequest, token, request)) return false;
      const message = errorMessage(error);
      if (action === "create" || action === "update") setEditorError(message);
      setStatus(message);
      return false;
    } finally {
      if (isCurrent(sessionToken, mutationRequest, token, request)) {
        activeOperation.current = "";
        setBusyAction("");
      }
    }
  }

  return {
    editorMode: sessionMatches ? editorMode : null,
    editorError: sessionMatches ? editorError : "",
    busyAction: sessionMatches ? busyAction : "",
    activeOperation,
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

function isCurrent(
  sessionToken: { current: string },
  requestRef: { current: number },
  token: string,
  request: number,
) {
  return sessionToken.current === token && requestRef.current === request;
}

function actionLabel(action: string) {
  return ({
    create: "Created",
    update: "Updated",
    deactivate: "Deactivated",
    activate: "Activated",
    archive: "Archived",
    restore: "Restored",
  } as Record<string, string>)[action] || "Changed";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Compliance Document Types request failed.";
}
