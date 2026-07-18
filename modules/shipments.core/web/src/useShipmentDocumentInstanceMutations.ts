import { useEffect, useRef, useState } from "react";

import {
  createShipmentDocumentInstance,
  setShipmentDocumentInstanceStatus,
  updateShipmentDocumentInstance,
} from "./shipmentDocumentInstancesApi";
import {
  instanceMutationError,
  instanceMutationSuccess,
  isCurrentInstanceRequest,
} from "./shipmentDocumentInstanceMutationSupport";
import type {
  ShipmentDocumentInstance,
  ShipmentDocumentInstanceEditorMode,
  ShipmentDocumentInstanceMetadataDraft,
  ShipmentDocumentInstanceStatusDraft,
} from "./shipmentDocumentInstanceTypes";

export function useShipmentDocumentInstanceMutations({
  token,
  shipmentId,
  canManage,
  onUnauthorized,
  invalidate,
  reload,
  onStatus,
  onRequirementChanged,
}: {
  token: string;
  shipmentId: string;
  canManage: boolean;
  onUnauthorized: () => void;
  invalidate: () => void;
  reload: () => Promise<boolean>;
  onStatus: (message: string) => void;
  onRequirementChanged: () => void;
}) {
  const sessionKey = `${token}:${shipmentId}:${canManage}`;
  const mountedRef = useRef(true);
  const sessionRef = useRef(sessionKey);
  const mutationRef = useRef(0);
  const activeOperation = useRef("");
  const unauthorizedRef = useRef(onUnauthorized);
  const requirementChangedRef = useRef(onRequirementChanged);
  const [stateSession, setStateSession] = useState(sessionKey);
  const [mode, setMode] = useState<ShipmentDocumentInstanceEditorMode | null>(null);
  const [target, setTarget] = useState<ShipmentDocumentInstance | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  unauthorizedRef.current = onUnauthorized;
  requirementChangedRef.current = onRequirementChanged;
  if (sessionRef.current !== sessionKey) {
    sessionRef.current = sessionKey;
    mutationRef.current += 1;
    activeOperation.current = "";
  }
  const sessionMatches = stateSession === sessionKey;

  useEffect(() => {
    mutationRef.current += 1;
    activeOperation.current = "";
    setStateSession(sessionKey);
    setMode(null);
    setTarget(null);
    setBusy("");
    setError("");
  }, [sessionKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      mutationRef.current += 1;
      activeOperation.current = "";
    };
  }, []);

  function open(
    nextMode: ShipmentDocumentInstanceEditorMode,
    nextTarget: ShipmentDocumentInstance | null = null,
  ) {
    if (!canManage || (nextMode !== "create" && !nextTarget)) return;
    setError("");
    setTarget(nextTarget);
    setMode(nextMode);
  }

  function close() {
    if (activeOperation.current) return;
    setMode(null);
    setTarget(null);
    setError("");
  }

  async function submitMetadata(draft: ShipmentDocumentInstanceMetadataDraft) {
    if (!canManage || !mode || mode === "status" || activeOperation.current) return;
    const handleUnauthorized = guardedUnauthorized();
    const operation = mode === "create"
      ? () => createShipmentDocumentInstance(
        token,
        shipmentId,
        draft,
        handleUnauthorized,
      )
      : target
        ? () => updateShipmentDocumentInstance(
          token,
          target,
          draft,
          handleUnauthorized,
        )
        : null;
    if (operation) await runMutation(operation, mode, false);
  }

  async function submitStatus(draft: ShipmentDocumentInstanceStatusDraft) {
    if (!canManage || mode !== "status" || !target || activeOperation.current) return;
    const handleUnauthorized = guardedUnauthorized();
    await runMutation(
      () => setShipmentDocumentInstanceStatus(
        token,
        target,
        draft,
        handleUnauthorized,
      ),
      mode,
      draft.newStatus === "verified" && draft.markRequirementReceived,
    );
  }

  function guardedUnauthorized() {
    const request = mutationRef.current + 1;
    const key = sessionKey;
    return () => {
      if (isCurrentInstanceRequest(mountedRef, sessionRef, mutationRef, key, request)) {
        unauthorizedRef.current();
      }
    };
  }

  async function runMutation(
    operation: () => Promise<ShipmentDocumentInstance>,
    action: ShipmentDocumentInstanceEditorMode,
    requirementChanged: boolean,
  ) {
    const request = ++mutationRef.current;
    const key = sessionKey;
    activeOperation.current = action;
    setBusy(action);
    setError("");
    invalidate();
    try {
      await operation();
      if (!isCurrentInstanceRequest(mountedRef, sessionRef, mutationRef, key, request)) return;
      const refreshed = await reload();
      if (!isCurrentInstanceRequest(mountedRef, sessionRef, mutationRef, key, request) || !refreshed) {
        return;
      }
      if (requirementChanged) requirementChangedRef.current();
      setMode(null);
      setTarget(null);
      onStatus(instanceMutationSuccess(action));
    } catch (cause) {
      if (!isCurrentInstanceRequest(mountedRef, sessionRef, mutationRef, key, request)) return;
      const message = instanceMutationError(cause);
      setError(message);
      onStatus(message);
    } finally {
      if (isCurrentInstanceRequest(mountedRef, sessionRef, mutationRef, key, request)) {
        activeOperation.current = "";
        setBusy("");
      }
    }
  }

  return {
    mode: sessionMatches ? mode : null,
    target: sessionMatches ? target : null,
    busy: sessionMatches ? busy : "",
    error: sessionMatches ? error : "",
    activeOperation,
    open,
    close,
    submitMetadata,
    submitStatus,
  };
}
