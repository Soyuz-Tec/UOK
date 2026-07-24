import { useEffect, useMemo, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
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
  host: ModuleSurfaceHostContext,
  operational: boolean,
) {
  const [stateToken, setStateToken] = useState(host.token);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<ComplianceDocumentTypeStatusFilter>("current");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState<ComplianceDocumentTypeSort>("code");
  const [sortDirection, setSortDirection] =
    useState<ComplianceDocumentTypeSortDirection>("asc");
  const [status, setStatus] = useState("Compliance Document Types ready.");
  const reads = useComplianceDocumentTypeReads(host, operational, setStatus);
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
    setStateToken(host.token);
    setQuery("");
    setStatusFilter("current");
    setCategoryFilter("all");
    setSortBy("code");
    setSortDirection("asc");
    setStatus("Compliance Document Types ready.");
  }, [host.token]);

  useEffect(() => {
    if (!host.token || !operational || selectionVisible) return;
    reads.setSelectedId(visibleDocumentTypes[0]?.id || "");
  }, [
    host.token,
    operational,
    reads.setSelectedId,
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
    query: stateToken === host.token ? query : "",
    setQuery,
    statusFilter: stateToken === host.token ? statusFilter : "current",
    setStatusFilter,
    categoryFilter: stateToken === host.token ? categoryFilter : "all",
    setCategoryFilter,
    sortBy: stateToken === host.token ? sortBy : "code",
    setSortBy,
    sortDirection: stateToken === host.token ? sortDirection : "asc",
    setSortDirection,
    busyAction: mutations.busyAction || (reads.refreshing ? "refresh" : ""),
    status: stateToken === host.token ? status : "Compliance Document Types ready.",
  };
}
