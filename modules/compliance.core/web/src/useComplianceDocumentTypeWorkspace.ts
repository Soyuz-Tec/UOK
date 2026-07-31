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
  const [stateToken, setStateToken] = useState(host.session.token);
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
    setStateToken(host.session.token);
    setQuery("");
    setStatusFilter("current");
    setCategoryFilter("all");
    setSortBy("code");
    setSortDirection("asc");
    setStatus("Compliance Document Types ready.");
  }, [host.session.token]);

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
    query: stateToken === host.session.token ? query : "",
    setQuery,
    statusFilter: stateToken === host.session.token ? statusFilter : "current",
    setStatusFilter,
    categoryFilter: stateToken === host.session.token ? categoryFilter : "all",
    setCategoryFilter,
    sortBy: stateToken === host.session.token ? sortBy : "code",
    setSortBy,
    sortDirection: stateToken === host.session.token ? sortDirection : "asc",
    setSortDirection,
    busyAction: mutations.busyAction || (reads.refreshing ? "refresh" : ""),
    status: stateToken === host.session.token
      ? status
      : "Compliance Document Types ready.",
  };
}
