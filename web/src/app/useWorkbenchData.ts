import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createRequestAuthority,
  type RequestAuthorityTicket
} from "../shared/request-authority";
import {
  workbenchRequestHeaders,
  type DashboardBundle,
  type StampedValue,
  type WorkbenchRequest,
  type WorkbenchSession,
} from "./workbenchDataContracts";
import type {
  Dashboard,
  ModuleStatus,
  QualityReport
} from "../shared/types";

export function useWorkbenchData(
  session: WorkbenchSession,
  isSessionGenerationCurrent: (generation: number) => boolean
) {
  const [outState, setOutState] = useState<StampedValue<unknown>>({
    generation: session.generation,
    value: session.token ? "Loading workspace..." : "Log in to begin."
  });
  const [dashboardState, setDashboardState] = useState<StampedValue<DashboardBundle> | null>(null);
  const [busyState, setBusyState] = useState<StampedValue<string>>({
    generation: session.generation,
    value: ""
  });
  const authorityRef = useRef(createRequestAuthority());
  const observedSessionGenerationRef = useRef(session.generation);
  const mountedRef = useRef(true);

  const beginRequest = useCallback((lane: string): WorkbenchRequest => {
    const generation = session.generation;
    const ticket: RequestAuthorityTicket = authorityRef.current.begin(lane);
    const isCurrent = () => (
      mountedRef.current &&
      isSessionGenerationCurrent(generation) &&
      ticket.isCurrent()
    );
    const guardedUnauthorized = ticket.onceIfCurrent(() => (
      isSessionGenerationCurrent(generation) ? session.onUnauthorized() : null
    ));
    return {
      generation,
      signal: ticket.signal,
      isCurrent,
      runIfCurrent<Result>(effect: () => Result) {
        return isCurrent() ? effect() : undefined;
      },
      onUnauthorized() {
        return isCurrent() ? guardedUnauthorized() : undefined;
      },
      release: ticket.release
    };
  }, [isSessionGenerationCurrent, session]);

  const setOut = useCallback((value: unknown, generation = session.generation) => {
    if (!mountedRef.current || !isSessionGenerationCurrent(generation)) return false;
    setOutState({ generation, value });
    return true;
  }, [isSessionGenerationCurrent, session.generation]);

  const setBusyAction = useCallback((value: string, generation = session.generation) => {
    if (!mountedRef.current || !isSessionGenerationCurrent(generation)) return false;
    setBusyState({ generation, value });
    return true;
  }, [isSessionGenerationCurrent, session.generation]);

  const clearBusyAction = useCallback((expectedValue: string, generation = session.generation) => {
    if (!mountedRef.current || !isSessionGenerationCurrent(generation)) return false;
    setBusyState((current) => (
      current.generation === generation && current.value === expectedValue
        ? { generation, value: "" }
        : current
    ));
    return true;
  }, [isSessionGenerationCurrent, session.generation]);

  const clearData = useCallback((
    message = "Signed out.",
    generation = session.generation
  ) => {
    if (!mountedRef.current || !isSessionGenerationCurrent(generation)) return false;
    authorityRef.current.invalidate();
    setDashboardState(null);
    setBusyState({ generation, value: "" });
    setOutState({ generation, value: message });
    return true;
  }, [isSessionGenerationCurrent, session.generation]);

  const apiResponse = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
    request?: WorkbenchRequest
  ): Promise<{ data: T; response: Response }> => {
    const requestGeneration = request?.generation ?? session.generation;
    const res = await fetch(path, {
      ...options,
      headers: { ...workbenchRequestHeaders(session.token), ...(options.headers || {}) },
      signal: options.signal ?? request?.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/register") {
        const clearedGeneration = request
          ? request.onUnauthorized()
          : isSessionGenerationCurrent(requestGeneration)
            ? session.onUnauthorized()
            : null;
        if (typeof clearedGeneration === "number") {
          clearData("Session expired. Sign in again.", clearedGeneration);
        }
      }
      throw data;
    }
    return { data: data as T, response: res };
  }, [clearData, isSessionGenerationCurrent, session]);

  const api = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
    request?: WorkbenchRequest
  ): Promise<T> => {
    return (await apiResponse<T>(path, options, request)).data;
  }, [apiResponse]);

  const refresh = useCallback(async (parentRequest?: WorkbenchRequest) => {
    if (!session.token || !isSessionGenerationCurrent(session.generation)) return false;
    const refreshRequest = beginRequest("host-refresh");
    let unauthorizedHandled = false;
    const isCombinedCurrent = () => refreshRequest.isCurrent() && Boolean(parentRequest?.isCurrent());
    const request: WorkbenchRequest = parentRequest ? {
      generation: refreshRequest.generation,
      signal: refreshRequest.signal,
      isCurrent: isCombinedCurrent,
      runIfCurrent<Result>(effect: () => Result) {
        return isCombinedCurrent() ? effect() : undefined;
      },
      onUnauthorized() {
        if (unauthorizedHandled || !isCombinedCurrent()) return undefined;
        unauthorizedHandled = true;
        return refreshRequest.onUnauthorized();
      },
      release: refreshRequest.release
    } : refreshRequest;
    const busyKey = "refresh";
    try {
      request.runIfCurrent(() => setBusyAction(busyKey, request.generation));
      const [dashboard, catalog, evidence, alignment] = await Promise.all([
        api<Dashboard>("/api/dashboard", {}, request),
        api<{ modules: Record<string, ModuleStatus> }>("/api/modules/catalog", {}, request),
        api<QualityReport>("/api/baseline-evidence", {}, request),
        api<QualityReport>("/api/architecture/alignment", {}, request)
      ]);
      if (!request.isCurrent()) return false;
      setDashboardState({
        generation: request.generation,
        value: {
          dashboard,
          modules: catalog.modules,
          evidence,
          alignment
        }
      });
      setOut({ status: "ready", counts: dashboard.counts }, request.generation);
      return true;
    } catch (error) {
      request.runIfCurrent(() => setOut(error, request.generation));
      return false;
    } finally {
      request.runIfCurrent(() => clearBusyAction(busyKey, request.generation));
      request.release();
    }
  }, [
    api,
    beginRequest,
    clearBusyAction,
    isSessionGenerationCurrent,
    session.generation,
    session.token,
    setBusyAction,
    setOut
  ]);

  useEffect(() => {
    if (observedSessionGenerationRef.current !== session.generation) {
      observedSessionGenerationRef.current = session.generation;
      authorityRef.current.invalidate();
    }
    if (session.token) {
      void refresh();
    }
  }, [refresh, session.generation, session.token]);

  useEffect(() => () => {
    mountedRef.current = false;
    authorityRef.current.dispose();
  }, []);

  const dashboardBundle = (
    dashboardState?.generation === session.generation &&
    isSessionGenerationCurrent(session.generation)
  ) ? dashboardState.value : null;
  const moduleRows = useMemo(() => (
    Object.values(dashboardBundle?.modules ?? {}).sort(
      (a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name)
    )
  ), [dashboardBundle]);
  const hasCurrentSession = isSessionGenerationCurrent(session.generation);
  const out = outState.generation === session.generation && hasCurrentSession
    ? outState.value
    : session.token
      ? "Loading workspace..."
      : "Log in to begin.";
  const busyAction = busyState.generation === session.generation && hasCurrentSession
    ? busyState.value
    : "";

  return {
    alignment: dashboardBundle?.alignment ?? null,
    api,
    beginRequest,
    busyAction,
    clearBusyAction,
    clearData,
    dashboard: dashboardBundle?.dashboard ?? null,
    evidence: dashboardBundle?.evidence ?? null,
    moduleRows,
    out,
    refresh,
    setBusyAction,
    setOut
  };
}

export type WorkbenchData = ReturnType<typeof useWorkbenchData>;
