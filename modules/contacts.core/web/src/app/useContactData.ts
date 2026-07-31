import { useCallback, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";

import type { ContactFilters } from "../contracts";
import { contactCommandApi } from "./contactCommandApi";
import { useContactPrimaryReads } from "./useContactPrimaryReads";

export function useContactData(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  filters: ContactFilters,
) {
  const reads = useContactPrimaryReads(host, operational, filters);
  const [busyAction, setBusyAction] = useState("");
  const [commandOutcome, setCommandOutcome] = useState<unknown>(null);
  const api = useCallback(<T,>(path: string, options: RequestInit = {}) => (
    contactCommandApi<T>(
      host.session.token,
      host.session.onUnauthorized,
      path,
      options,
    )
  ), [host.session.onUnauthorized, host.session.token]);

  return {
    ...reads,
    api,
    busyAction: busyAction || (reads.refreshing ? "refresh" : ""),
    out: commandOutcome ?? reads.out,
    setBusyAction,
    setOut: setCommandOutcome,
  };
}

export type ContactData = ReturnType<typeof useContactData>;
