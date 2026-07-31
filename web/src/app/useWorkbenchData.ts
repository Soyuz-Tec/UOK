import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Dashboard,
  ModuleStatus,
  QualityReport
} from "../shared/types";

function requestHeaders(token: string, overrideToken?: string) {
  const value: Record<string, string> = { "Content-Type": "application/json" };
  const activeToken = overrideToken ?? token;
  if (activeToken) value.Authorization = `Bearer ${activeToken}`;
  return value;
}

export function useWorkbenchData(token: string, onUnauthorized: () => void) {
  const [out, setOut] = useState<unknown>("Log in to begin.");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [modules, setModules] = useState<Record<string, ModuleStatus>>({});
  const [evidence, setEvidence] = useState<QualityReport | null>(null);
  const [alignment, setAlignment] = useState<QualityReport | null>(null);
  const [busyAction, setBusyAction] = useState<string>("");

  const moduleRows = useMemo(() => Object.values(modules).sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name)), [modules]);

  const clearData = useCallback((message = "Signed out.") => {
    setDashboard(null);
    setModules({});
    setEvidence(null);
    setAlignment(null);
    setBusyAction("");
    setOut(message);
  }, []);

  const apiResponse = useCallback(async <T,>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<{ data: T; response: Response }> => {
    const res = await fetch(path, {
      ...options,
      headers: { ...requestHeaders(token, overrideToken), ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/register") {
        onUnauthorized();
        clearData("Session expired. Sign in again.");
      }
      throw data;
    }
    return { data: data as T, response: res };
  }, [clearData, onUnauthorized, token]);

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
    return (await apiResponse<T>(path, options, overrideToken)).data;
  }, [apiResponse]);

  const refresh = useCallback(async (overrideToken?: string) => {
    const activeToken = overrideToken ?? token;
    if (!activeToken) return;
    try {
      setBusyAction("refresh");
      const [dash, catalog, evidenceBody, alignmentBody] = await Promise.all([
        api<Dashboard>("/api/dashboard", {}, activeToken),
        api<{ modules: Record<string, ModuleStatus> }>("/api/modules/catalog", {}, activeToken),
        api<QualityReport>("/api/baseline-evidence", {}, activeToken),
        api<QualityReport>("/api/architecture/alignment", {}, activeToken)
      ]);
      setDashboard(dash);
      setModules(catalog.modules);
      setEvidence(evidenceBody);
      setAlignment(alignmentBody);
      setOut({ status: "ready", counts: dash.counts });
    } catch (error) {
      setOut(error);
    } finally {
      setBusyAction("");
    }
  }, [api, token]);

  useEffect(() => {
    if (!token) return;
    void refresh();
  }, [refresh, token]);

  return {
    alignment,
    api,
    busyAction,
    clearData,
    dashboard,
    evidence,
    moduleRows,
    out,
    refresh,
    setBusyAction,
    setOut,
  };
}

export type WorkbenchData = ReturnType<typeof useWorkbenchData>;
