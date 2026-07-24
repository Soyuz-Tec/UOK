import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadShipmentDocumentRequirements,
  loadShipmentDocumentTypeOptions,
} from "./shipmentDocumentRequirementsApi";
import {
  emptyRequirementSummary,
  type ShipmentDocumentRequirement,
  type ShipmentDocumentRequirementSummary,
  type ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";

export function useShipmentDocumentRequirementReads({
  token,
  shipmentId,
  onUnauthorized,
  onError,
}: {
  token: string;
  shipmentId: string;
  onUnauthorized: () => void;
  onError: (message: string) => void;
}) {
  const sessionKey = `${token}:${shipmentId}`;
  const mountedRef = useRef(true);
  const sessionRef = useRef(sessionKey);
  const requestRef = useRef(0);
  const unauthorizedRef = useRef(onUnauthorized);
  const errorRef = useRef(onError);
  const [stateSession, setStateSession] = useState(sessionKey);
  const [items, setItems] = useState<ShipmentDocumentRequirement[]>([]);
  const [summary, setSummary] = useState<ShipmentDocumentRequirementSummary>(
    emptyRequirementSummary,
  );
  const [options, setOptions] = useState<ShipmentDocumentTypeReference[]>([]);
  const [loading, setLoading] = useState(false);
  unauthorizedRef.current = onUnauthorized;
  errorRef.current = onError;
  if (sessionRef.current !== sessionKey) {
    sessionRef.current = sessionKey;
    requestRef.current += 1;
  }
  const sessionMatches = stateSession === sessionKey;

  const reload = useCallback(async () => {
    if (!token || !shipmentId) return false;
    const key = `${token}:${shipmentId}`;
    const request = ++requestRef.current;
    const handleUnauthorized = () => {
      if (isCurrent(mountedRef, sessionRef, requestRef, key, request)) {
        unauthorizedRef.current();
      }
    };
    setLoading(true);
    try {
      const [response, documentTypes] = await Promise.all([
        loadShipmentDocumentRequirements(token, shipmentId, handleUnauthorized),
        loadShipmentDocumentTypeOptions(token, handleUnauthorized),
      ]);
      if (!isCurrent(mountedRef, sessionRef, requestRef, key, request)) return false;
      setStateSession(key);
      setItems(response.items);
      setSummary(response.summary);
      setOptions(documentTypes.filter((option) => option.status === "ready"));
      return true;
    } catch (error) {
      if (isCurrent(mountedRef, sessionRef, requestRef, key, request)) {
        setStateSession(key);
        setItems([]);
        setSummary(emptyRequirementSummary);
        setOptions([]);
        errorRef.current(errorMessage(error));
      }
      return false;
    } finally {
      if (isCurrent(mountedRef, sessionRef, requestRef, key, request)) {
        setLoading(false);
      }
    }
  }, [shipmentId, token]);

  useEffect(() => {
    requestRef.current += 1;
    setStateSession(sessionKey);
    setItems([]);
    setSummary(emptyRequirementSummary);
    setOptions([]);
    setLoading(false);
    if (token && shipmentId) void reload();
  }, [reload, sessionKey, shipmentId, token]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestRef.current += 1;
    };
  }, []);

  function invalidate() {
    requestRef.current += 1;
    setLoading(false);
  }

  return {
    items: sessionMatches ? items : [],
    summary: sessionMatches ? summary : emptyRequirementSummary,
    options: sessionMatches ? options : [],
    loading: sessionMatches && loading,
    reload,
    invalidate,
  };
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

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment document requirements request failed.";
}
