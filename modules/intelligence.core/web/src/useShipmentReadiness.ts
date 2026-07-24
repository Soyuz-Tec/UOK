import { useCallback, useEffect, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import {
  IntelligenceRequestError,
  loadShipmentReadiness,
} from "./intelligenceApi";
import type { ShipmentReadinessSignal } from "./types";

export function useShipmentReadiness(
  host: ModuleSurfaceHostContext,
  operational: boolean,
) {
  const sessionToken = useRef(host.token);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const lastRefreshRevision = useRef(host.moduleRefreshRevision);
  const onUnauthorized = useRef(host.onUnauthorized);
  const [stateToken, setStateToken] = useState(host.token);
  const [signals, setSignals] = useState<ShipmentReadinessSignal[]>([]);
  const [sourceSummary, setSourceSummary] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(host.token && operational));

  onUnauthorized.current = host.onUnauthorized;
  if (sessionToken.current !== host.token) {
    sessionToken.current = host.token;
    requestGeneration.current += 1;
  }

  const sessionMatches = stateToken === host.token;

  const refresh = useCallback(async () => {
    if (!host.token || !operational) return;
    const token = host.token;
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await loadShipmentReadiness(token, controller.signal);
      if (!isCurrent(sessionToken, requestGeneration, token, generation)) return;
      setStateToken(token);
      setSignals(response.items);
      setSourceSummary(response.source_summary);
    } catch (requestError) {
      if (!isCurrent(sessionToken, requestGeneration, token, generation)) return;
      if (isAbortError(requestError)) return;
      if (requestError instanceof IntelligenceRequestError && requestError.status === 401) {
        onUnauthorized.current();
      }
      const message = errorMessage(requestError);
      setStateToken(token);
      setSignals([]);
      setSourceSummary("");
      setError(message);
    } finally {
      if (isCurrent(sessionToken, requestGeneration, token, generation)) {
        setLoading(false);
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    }
  }, [host.token, operational]);

  useEffect(() => {
    lastRefreshRevision.current = host.moduleRefreshRevision;
    requestGeneration.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setStateToken(host.token);
    setSignals([]);
    setSourceSummary("");
    setError("");
    setLoading(Boolean(host.token && operational));
    if (host.token && operational) void refresh();
  }, [host.token, operational, refresh]);

  useEffect(() => {
    if (lastRefreshRevision.current === host.moduleRefreshRevision) return;
    lastRefreshRevision.current = host.moduleRefreshRevision;
    if (host.token && operational) void refresh();
  }, [host.moduleRefreshRevision, host.token, operational, refresh]);

  useEffect(() => () => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
  }, []);

  return {
    signals: sessionMatches ? signals : [],
    sourceSummary: sessionMatches ? sourceSummary : "",
    error: sessionMatches ? error : "",
    loading: sessionMatches ? loading : Boolean(host.token && operational),
    refresh,
  };
}

function isCurrent(
  sessionToken: { current: string },
  requestGeneration: { current: number },
  token: string,
  generation: number,
) {
  return sessionToken.current === token && requestGeneration.current === generation;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment Readiness request failed.";
}
