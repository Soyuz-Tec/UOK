import { useEffect, useRef, useState } from "react";
import {
  addShipmentDocumentRequirement,
  removeShipmentDocumentRequirement,
  setShipmentDocumentRequirementStatus,
  updateShipmentDocumentRequirement,
} from "./shipmentDocumentRequirementsApi";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentRequirementDraft,
  ShipmentDocumentRequirementEditorMode,
} from "./shipmentDocumentRequirementTypes";

export function useShipmentDocumentRequirementMutations({
  token,
  shipmentId,
  canManage,
  onUnauthorized,
  invalidate,
  reload,
  onStatus,
}: {
  token: string;
  shipmentId: string;
  canManage: boolean;
  onUnauthorized: () => void;
  invalidate: () => void;
  reload: () => Promise<boolean>;
  onStatus: (message: string) => void;
}) {
  const sessionKey = `${token}:${shipmentId}:${canManage}`;
  const mountedRef = useRef(true);
  const sessionRef = useRef(sessionKey);
  const mutationRef = useRef(0);
  const activeOperation = useRef("");
  const unauthorizedRef = useRef(onUnauthorized);
  const [stateSession, setStateSession] = useState(sessionKey);
  const [mode, setMode] = useState<ShipmentDocumentRequirementEditorMode | null>(null);
  const [target, setTarget] = useState<ShipmentDocumentRequirement | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  unauthorizedRef.current = onUnauthorized;
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
    nextMode: ShipmentDocumentRequirementEditorMode,
    nextTarget: ShipmentDocumentRequirement | null = null,
  ) {
    if (!canManage || (nextMode !== "add" && !nextTarget)) return;
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

  async function submit(draft: ShipmentDocumentRequirementDraft) {
    if (!canManage || !mode || activeOperation.current) return;
    const request = ++mutationRef.current;
    const key = sessionKey;
    const handleUnauthorized = () => {
      if (isCurrent(mountedRef, sessionRef, mutationRef, key, request)) {
        unauthorizedRef.current();
      }
    };
    const operation = commandFor(
      mode,
      token,
      shipmentId,
      target,
      draft,
      handleUnauthorized,
    );
    if (!operation) return;
    activeOperation.current = mode;
    setBusy(mode);
    setError("");
    invalidate();
    try {
      await operation();
      if (!isCurrent(mountedRef, sessionRef, mutationRef, key, request)) return;
      const refreshed = await reload();
      if (!isCurrent(mountedRef, sessionRef, mutationRef, key, request) || !refreshed) {
        return;
      }
      setMode(null);
      setTarget(null);
      onStatus(successMessage(mode));
    } catch (cause) {
      if (!isCurrent(mountedRef, sessionRef, mutationRef, key, request)) return;
      const message = errorMessage(cause);
      setError(message);
      onStatus(message);
    } finally {
      if (isCurrent(mountedRef, sessionRef, mutationRef, key, request)) {
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
    submit,
  };
}

function commandFor(
  mode: ShipmentDocumentRequirementEditorMode,
  token: string,
  shipmentId: string,
  target: ShipmentDocumentRequirement | null,
  draft: ShipmentDocumentRequirementDraft,
  onUnauthorized: () => void,
) {
  if (mode === "add") {
    return () => addShipmentDocumentRequirement(token, shipmentId, draft, onUnauthorized);
  }
  if (!target) return null;
  if (mode === "edit") {
    return () => updateShipmentDocumentRequirement(token, target, draft, onUnauthorized);
  }
  const nextStatus = draft.newStatus;
  if (mode === "status" && nextStatus) {
    return () => setShipmentDocumentRequirementStatus(
      token,
      target,
      nextStatus,
      draft.reason,
      onUnauthorized,
    );
  }
  if (mode === "remove") {
    return () => removeShipmentDocumentRequirement(token, target, draft.reason, onUnauthorized);
  }
  return null;
}

function isCurrent(
  mountedRef: { current: boolean },
  sessionRef: { current: string },
  requestRef: { current: number },
  key: string,
  request: number,
) {
  return mountedRef.current
    && sessionRef.current === key
    && requestRef.current === request;
}

function successMessage(mode: ShipmentDocumentRequirementEditorMode) {
  return ({
    add: "Added shipment document requirement.",
    edit: "Updated shipment document requirement.",
    status: "Updated shipment document requirement status.",
    remove: "Removed shipment document requirement.",
  })[mode];
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment document requirement command failed.";
}
