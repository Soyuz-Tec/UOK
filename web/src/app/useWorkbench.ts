import { useCallback, useMemo, useState } from "react";

import type { ModuleSurfaceHostContext } from "../contracts/moduleSurface";
import { useAuthState } from "./useAuthState";
import { useAuthWorkflows } from "./useAuthWorkflows";
import { useWorkbenchActions } from "./useWorkbenchActions";
import { useWorkbenchData } from "./useWorkbenchData";
import { useWorkbenchPreferences } from "./useWorkbenchPreferences";
import type { Section } from "../shared/types";
import { sectionFromSearch } from "./workbenchNavigation";

export function useWorkbench() {
  const [active, setActive] = useState<Section>(() => sectionFromSearch(window.location.search));
  const [moduleRefreshRevision, setModuleRefreshRevision] = useState(0);
  const preferences = useWorkbenchPreferences();
  const auth = useAuthState();
  const {
    authMode,
    currentUser,
    isSessionGenerationCurrent,
    loginError,
    password,
    registerEmail,
    registerError,
    registerName,
    registerPassword,
    setAuthMode,
    setPassword,
    setRegisterEmail,
    setRegisterName,
    setRegisterPassword,
    setUsername,
    token,
    username
  } = auth;
  const data = useWorkbenchData(auth.session, isSessionGenerationCurrent);
  const dataRefresh = data.refresh;
  const authWorkflows = useAuthWorkflows(auth, data);
  const actions = useWorkbenchActions(data);
  const refresh = useCallback(async () => {
    const refreshed = await dataRefresh();
    if (refreshed) {
      setModuleRefreshRevision((revision) => revision + 1);
    }
  }, [dataRefresh]);
  const sessionGeneration = auth.session.generation;
  const clearSession = authWorkflows.clearSession;
  const moduleSession = useMemo(() => ({
    token,
    generation: sessionGeneration,
    onUnauthorized: () => {
      clearSession("Session expired. Sign in again.", sessionGeneration);
    }
  }), [clearSession, sessionGeneration, token]);
  const moduleHost: ModuleSurfaceHostContext = {
    session: moduleSession,
    currentUserRole: currentUser?.role || "",
    appearance: preferences.appearance,
    moduleRows: data.moduleRows,
    busyAction: data.busyAction,
    moduleAction: actions.moduleAction,
    refreshHost: refresh,
    moduleRefreshRevision,
  };

  return {
    active,
    setActive,
    appearance: preferences.appearance,
    setAppearance: preferences.setAppearance,
    locale: preferences.locale,
    setLocale: preferences.setLocale,
    sidebarCollapsed: preferences.sidebarCollapsed,
    setSidebarCollapsed: preferences.setSidebarCollapsed,
    authMode,
    setAuthMode,
    username,
    setUsername,
    password,
    setPassword,
    registerName,
    setRegisterName,
    registerEmail,
    setRegisterEmail,
    registerPassword,
    setRegisterPassword,
    token,
    currentUser,
    loginError,
    registerError,
    out: data.out,
    dashboard: data.dashboard,
    moduleRows: data.moduleRows,
    evidence: data.evidence,
    alignment: data.alignment,
    busyAction: data.busyAction,
    clearSession: authWorkflows.clearSession,
    refresh,
    login: authWorkflows.login,
    register: authWorkflows.register,
    moduleAction: actions.moduleAction,
    moduleHost,
  };
}

export type Workbench = ReturnType<typeof useWorkbench>;
