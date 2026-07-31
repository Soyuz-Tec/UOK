import { useCallback, useEffect, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import {
  IntelligenceRequestError,
  loadShipmentReadiness,
} from "./intelligenceApi";
import type {
  ShipmentReadinessEvaluationMetadata,
  ShipmentReadinessSignal,
} from "./types";

export function useShipmentReadiness(
  host: ModuleSurfaceHostContext,
  operational: boolean,
  asOf: string | null,
) {
  const sessionToken = useRef(host.token);
  const requestAsOf = useRef(asOf);
  const requestGeneration = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const lastRefreshRevision = useRef(host.moduleRefreshRevision);
  const onUnauthorized = useRef(host.onUnauthorized);
  const [stateToken, setStateToken] = useState(host.token);
  const [stateAsOf, setStateAsOf] = useState(asOf);
  const [signals, setSignals] = useState<ShipmentReadinessSignal[]>([]);
  const [sourceSummary, setSourceSummary] = useState("");
  const [evaluation, setEvaluation] = useState<
    ShipmentReadinessEvaluationMetadata | null
  >(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(
    Boolean(host.token && operational && asOf),
  );

  onUnauthorized.current = host.onUnauthorized;
  if (sessionToken.current !== host.token || requestAsOf.current !== asOf) {
    sessionToken.current = host.token;
    requestAsOf.current = asOf;
    lastRefreshRevision.current = host.moduleRefreshRevision;
    requestGeneration.current += 1;
  }

  const requestMatches = stateToken === host.token && stateAsOf === asOf;

  const refresh = useCallback(async () => {
    if (!host.token || !operational || !asOf) return;
    const token = host.token;
    const requestedAsOf = asOf;
    const generation = ++requestGeneration.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const response = await loadShipmentReadiness(
        token,
        requestedAsOf,
        controller.signal,
      );
      if (!isCurrent(
        sessionToken,
        requestAsOf,
        requestGeneration,
        token,
        requestedAsOf,
        generation,
      )) return;
      setStateToken(token);
      setStateAsOf(requestedAsOf);
      setSignals(response.items);
      setSourceSummary(response.source_summary);
      setEvaluation(evaluationMetadata(response));
    } catch (requestError) {
      if (!isCurrent(
        sessionToken,
        requestAsOf,
        requestGeneration,
        token,
        requestedAsOf,
        generation,
      )) return;
      if (isAbortError(requestError)) return;
      if (requestError instanceof IntelligenceRequestError && requestError.status === 401) {
        onUnauthorized.current();
      }
      const message = errorMessage(requestError);
      setStateToken(token);
      setStateAsOf(requestedAsOf);
      setSignals([]);
      setSourceSummary("");
      setEvaluation(null);
      setError(message);
    } finally {
      if (isCurrent(
        sessionToken,
        requestAsOf,
        requestGeneration,
        token,
        requestedAsOf,
        generation,
      )) {
        setLoading(false);
        if (activeRequest.current === controller) activeRequest.current = null;
      }
    }
  }, [asOf, host.token, operational]);

  useEffect(() => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
    activeRequest.current = null;
    setStateToken(host.token);
    setStateAsOf(asOf);
    setSignals([]);
    setSourceSummary("");
    setEvaluation(null);
    setError("");
    setLoading(Boolean(host.token && operational && asOf));
    if (host.token && operational && asOf) void refresh();
  }, [asOf, host.token, operational, refresh]);

  useEffect(() => {
    if (lastRefreshRevision.current === host.moduleRefreshRevision) return;
    lastRefreshRevision.current = host.moduleRefreshRevision;
    if (host.token && operational && asOf) void refresh();
  }, [asOf, host.moduleRefreshRevision, host.token, operational, refresh]);

  useEffect(() => () => {
    requestGeneration.current += 1;
    activeRequest.current?.abort();
  }, []);

  return {
    signals: requestMatches ? signals : [],
    sourceSummary: requestMatches ? sourceSummary : "",
    evaluation: requestMatches ? evaluation : null,
    error: requestMatches ? error : "",
    loading: requestMatches
      ? loading
      : Boolean(host.token && operational && asOf),
    refresh,
  };
}

function isCurrent(
  sessionToken: { current: string },
  requestAsOf: { current: string | null },
  requestGeneration: { current: number },
  token: string,
  asOf: string,
  generation: number,
) {
  return sessionToken.current === token
    && requestAsOf.current === asOf
    && requestGeneration.current === generation;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Shipment Readiness request failed.";
}

function evaluationMetadata(
  response: ShipmentReadinessEvaluationMetadata,
): ShipmentReadinessEvaluationMetadata {
  return {
    as_of: response.as_of,
    evaluation_timezone: response.evaluation_timezone,
    expiring_soon_horizon_days: response.expiring_soon_horizon_days,
    expiring_soon_through: response.expiring_soon_through,
  };
}
