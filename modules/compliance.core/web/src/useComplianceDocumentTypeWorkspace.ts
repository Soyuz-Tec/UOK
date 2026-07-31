import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import type { ComplianceMutationInteraction } from "./complianceMutationAuthority";
import {
  complianceDocumentTypeCategories,
  filterAndSortComplianceDocumentTypes,
} from "./complianceFilters";
import type {
  ComplianceDocumentTypeSort,
  ComplianceDocumentTypeSortDirection,
  ComplianceDocumentTypeStatusFilter,
} from "./types";
import { useComplianceDocumentTypeMutations } from "./useComplianceDocumentTypeMutations";
import { useComplianceDocumentTypeReads } from "./useComplianceDocumentTypeReads";

export function useComplianceDocumentTypeWorkspace(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  canManage: boolean,
) {
  const [stateSession, setStateSession] = useState({
    token: host.session.token,
    generation: host.session.generation,
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ComplianceDocumentTypeStatusFilter>("current");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ComplianceDocumentTypeSort>("code");
  const [sortDirection, setSortDirection] =
    useState<ComplianceDocumentTypeSortDirection>("asc");
  const [status, setStatus] = useState("Compliance Document Types ready.");
  const interactionRef = useRef<ComplianceMutationInteraction>({
    criteriaGeneration: 0,
    selectionGeneration: 0,
    selectedId: "",
    selectedVersion: null,
  });
  const reads = useComplianceDocumentTypeReads(host, operational, setStatus);
  const { setSelectedId } = reads;
  const categories = useMemo(
    () => complianceDocumentTypeCategories(reads.documentTypes),
    [reads.documentTypes],
  );
  const visibleDocumentTypes = useMemo(
    () => filterAndSortComplianceDocumentTypes(reads.documentTypes, {
      query,
      status: statusFilter,
      category: categoryFilter,
      sortBy,
      sortDirection,
    }),
    [categoryFilter, query, reads.documentTypes, sortBy, sortDirection, statusFilter],
  );
  const selectionVisible = visibleDocumentTypes.some(
    (row) => row.id === reads.selectedId,
  );
  const selected = selectionVisible ? reads.selected : null;
  interactionRef.current = {
    ...interactionRef.current,
    selectedId: selected?.id || "",
    selectedVersion: selected?.version ?? null,
  };
  const setWorkspaceSelectedId = useCallback((value: string) => {
    const row = reads.documentTypes.find((candidate) => candidate.id === value);
    interactionRef.current = {
      ...interactionRef.current,
      selectionGeneration: interactionRef.current.selectionGeneration + 1,
      selectedId: value,
      selectedVersion: row?.version ?? null,
    };
    setSelectedId(value);
  }, [reads.documentTypes, setSelectedId]);
  const updateCriteria = useCallback(<Value,>(
    setter: (value: Value) => void,
    value: Value,
  ) => {
    interactionRef.current = {
      ...interactionRef.current,
      criteriaGeneration: interactionRef.current.criteriaGeneration + 1,
    };
    setter(value);
  }, []);
  const mutations = useComplianceDocumentTypeMutations({
    host,
    operational,
    canManage,
    interactionRef,
    selected,
    reconcileDocumentTypes: reads.reconcileDocumentTypes,
    supersedeReadsForMutation: reads.supersedeReadsForMutation,
    setStatus,
    setStatusFilter: (value) => updateCriteria(setStatusFilter, value),
  });

  useEffect(() => {
    interactionRef.current = {
      ...interactionRef.current,
      criteriaGeneration: interactionRef.current.criteriaGeneration + 1,
      selectionGeneration: interactionRef.current.selectionGeneration + 1,
      selectedId: "",
      selectedVersion: null,
    };
    setStateSession({
      token: host.session.token,
      generation: host.session.generation,
    });
    setQuery("");
    setStatusFilter("current");
    setCategoryFilter("all");
    setSortBy("code");
    setSortDirection("asc");
    setStatus("Compliance Document Types ready.");
  }, [host.session.generation, host.session.token]);

  useEffect(() => {
    if (!host.session.token || !operational || selectionVisible) return;
    setWorkspaceSelectedId(visibleDocumentTypes[0]?.id || "");
  }, [
    host.session.token,
    operational,
    setWorkspaceSelectedId,
    selectionVisible,
    visibleDocumentTypes,
  ]);

  async function refreshWorkspace() {
    if (mutations.reconciliationPending) {
      await mutations.retryPendingReconciliation();
      return;
    }
    if (!mutations.operationActive) await reads.refreshDocumentTypes();
  }

  return {
    ...reads,
    ...mutations,
    documentTypes: visibleDocumentTypes,
    selected,
    selectedId: selectionVisible ? reads.selectedId : "",
    setSelectedId: setWorkspaceSelectedId,
    categories,
    query: sessionMatches(stateSession, host.session) ? query : "",
    setQuery: (value: string) => updateCriteria(setQuery, value),
    statusFilter: sessionMatches(stateSession, host.session) ? statusFilter : "current",
    setStatusFilter: (value: ComplianceDocumentTypeStatusFilter) => (
      updateCriteria(setStatusFilter, value)
    ),
    categoryFilter: sessionMatches(stateSession, host.session) ? categoryFilter : "all",
    setCategoryFilter: (value: string) => updateCriteria(setCategoryFilter, value),
    sortBy: sessionMatches(stateSession, host.session) ? sortBy : "code",
    setSortBy: (value: ComplianceDocumentTypeSort) => updateCriteria(setSortBy, value),
    sortDirection: sessionMatches(stateSession, host.session) ? sortDirection : "asc",
    setSortDirection: (value: ComplianceDocumentTypeSortDirection) => (
      updateCriteria(setSortDirection, value)
    ),
    busyAction: mutations.busyAction || (reads.refreshing ? "refresh" : ""),
    refreshWorkspace,
    status: sessionMatches(stateSession, host.session)
      ? status
      : "Compliance Document Types ready.",
  };
}

function sessionMatches(
  state: { token: string; generation: number },
  session: { token: string; generation: number },
) {
  return state.token === session.token && state.generation === session.generation;
}
