import { useCallback, useEffect, useRef, useState } from "react";

import {
  loadInstanceDocumentTypeOptions,
  loadInstanceRequirementOptions,
  loadShipmentDocumentInstances,
} from "./shipmentDocumentInstancesApi";
import type {
  ShipmentDocumentRequirement,
  ShipmentDocumentTypeReference,
} from "./shipmentDocumentRequirementTypes";
import type { ShipmentDocumentInstance } from "./shipmentDocumentInstanceTypes";

export function useShipmentDocumentInstanceReads({
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
  const [items, setItems] = useState<ShipmentDocumentInstance[]>([]);
  const [requirements, setRequirements] = useState<ShipmentDocumentRequirement[]>([]);
  const [documentTypes, setDocumentTypes] = useState<ShipmentDocumentTypeReference[]>([]);
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
      const [instances, requirementList, typeOptions] = await Promise.all([
        loadShipmentDocumentInstances(token, shipmentId, handleUnauthorized),
        loadInstanceRequirementOptions(token, shipmentId, handleUnauthorized),
        loadInstanceDocumentTypeOptions(token, handleUnauthorized),
      ]);
      if (!isCurrent(mountedRef, sessionRef, requestRef, key, request)) return false;
      setStateSession(key);
      setItems(instances);
      setRequirements(requirementList.items);
      setDocumentTypes(typeOptions.filter((option) => option.status === "ready"));
      return true;
    } catch (error) {
      if (isCurrent(mountedRef, sessionRef, requestRef, key, request)) {
        setStateSession(key);
        setItems([]);
        setRequirements([]);
        setDocumentTypes([]);
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
    setRequirements([]);
    setDocumentTypes([]);
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
    requirements: sessionMatches ? requirements : [],
    documentTypes: sessionMatches ? documentTypes : [],
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
    : "Shipment document instances request failed.";
}
