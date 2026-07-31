import { useEffect, useMemo, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
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
  const mutations = useComplianceDocumentTypeMutations({
    host,
    selected,
    applyDocumentType: reads.applyDocumentType,
    invalidateRefresh: reads.invalidateRefresh,
    setStatus,
    setStatusFilter,
  });

  useEffect(() => {
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
    setSelectedId(visibleDocumentTypes[0]?.id || "");
  }, [
    host.session.token,
    operational,
    setSelectedId,
    selectionVisible,
    visibleDocumentTypes,
  ]);

  return {
    ...reads,
    ...mutations,
    documentTypes: visibleDocumentTypes,
    selected,
    selectedId: selectionVisible ? reads.selectedId : "",
    categories,
    query: sessionMatches(stateSession, host.session) ? query : "",
    setQuery,
    statusFilter: sessionMatches(stateSession, host.session) ? statusFilter : "current",
    setStatusFilter,
    categoryFilter: sessionMatches(stateSession, host.session) ? categoryFilter : "all",
    setCategoryFilter,
    sortBy: sessionMatches(stateSession, host.session) ? sortBy : "code",
    setSortBy,
    sortDirection: sessionMatches(stateSession, host.session) ? sortDirection : "asc",
    setSortDirection,
    busyAction: mutations.busyAction || (reads.refreshing ? "refresh" : ""),
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
