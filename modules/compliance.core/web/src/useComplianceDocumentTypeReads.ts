import { useCallback, useEffect, useRef, useState } from "react";

import type { ModuleSurfaceHostContext } from "@uok/contracts/moduleSurface";
import {
  loadComplianceDocumentType,
  loadComplianceDocumentTypeNameHistory,
  loadComplianceDocumentTypes,
} from "./complianceApi";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "./types";

export function useComplianceDocumentTypeReads(
  host: ModuleSurfaceHostContext,
  operational: boolean,
  setStatus: (value: string) => void,
) {
  const sessionToken = useRef(host.token);
  const listRequest = useRef(0);
  const detailRequest = useRef(0);
  const lastRefreshRevision = useRef(host.moduleRefreshRevision);
  const previousSession = useRef<{ token: string; operational: boolean } | null>(null);
  const onUnauthorized = useRef(host.onUnauthorized);
  const updateStatus = useRef(setStatus);
  const [stateToken, setStateToken] = useState(host.token);
  const [documentTypes, setDocumentTypes] = useState<ComplianceDocumentType[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ComplianceDocumentType | null>(null);
  const [history, setHistory] = useState<ComplianceDocumentTypeNameHistory[]>([]);
  const [historyOwnerId, setHistoryOwnerId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  onUnauthorized.current = host.onUnauthorized;
  updateStatus.current = setStatus;
  if (sessionToken.current !== host.token) {
    sessionToken.current = host.token;
    listRequest.current += 1;
    detailRequest.current += 1;
  }
  const sessionMatches = stateToken === host.token;
  const safeRows = sessionMatches ? documentTypes : [];
  const safeSelectedId = sessionMatches ? selectedId : "";
  const listSelected = safeRows.find((row) => row.id === safeSelectedId) || null;
  const selected = detail?.id === safeSelectedId ? detail : listSelected;

  const refreshDocumentTypes = useCallback(async () => {
    if (!host.token || !operational) return;
    const token = host.token;
    const request = ++listRequest.current;
    setRefreshing(true);
    try {
      const rows = await loadComplianceDocumentTypes(token, onUnauthorized.current);
      if (!isCurrent(sessionToken, listRequest, token, request)) return;
      setStateToken(token);
      setDocumentTypes(rows);
      setSelectedId((current) => rows.some((row) => row.id === current)
        ? current
        : rows.find((row) => row.status === "active")?.id
          || rows.find((row) => row.status === "inactive")?.id
          || rows[0]?.id
          || "");
      updateStatus.current(`${rows.length} compliance document type(s) loaded.`);
    } catch (error) {
      if (isCurrent(sessionToken, listRequest, token, request)) {
        updateStatus.current(errorMessage(error));
      }
    } finally {
      if (isCurrent(sessionToken, listRequest, token, request)) setRefreshing(false);
    }
  }, [host.token, operational]);

  useEffect(() => {
    const sessionChanged = previousSession.current?.token !== host.token
      || previousSession.current.operational !== operational;
    const refreshRequested =
      lastRefreshRevision.current !== host.moduleRefreshRevision;
    previousSession.current = { token: host.token, operational };
    lastRefreshRevision.current = host.moduleRefreshRevision;
    if (sessionChanged) {
      listRequest.current += 1;
      detailRequest.current += 1;
      setStateToken(host.token);
      setDocumentTypes([]);
      setSelectedId("");
      setDetail(null);
      setHistory([]);
      setHistoryOwnerId("");
      setHistoryLoading(false);
      setRefreshing(false);
    }
    if (
      (sessionChanged || refreshRequested)
      && host.token
      && operational
    ) {
      void refreshDocumentTypes();
    }
  }, [
    host.moduleRefreshRevision,
    host.token,
    operational,
    refreshDocumentTypes,
  ]);

  useEffect(() => {
    const token = host.token;
    const request = ++detailRequest.current;
    setDetail(null);
    setHistory([]);
    setHistoryOwnerId("");
    if (!token || !operational || !safeSelectedId) {
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    void Promise.all([
      loadComplianceDocumentType(token, safeSelectedId, onUnauthorized.current),
      loadComplianceDocumentTypeNameHistory(token, safeSelectedId, onUnauthorized.current),
    ]).then(([documentType, rows]) => {
      if (!isCurrent(sessionToken, detailRequest, token, request)) return;
      setDetail(documentType);
      setHistory(rows);
      setHistoryOwnerId(safeSelectedId);
    }).catch((error) => {
      if (!isCurrent(sessionToken, detailRequest, token, request)) return;
      setDetail(null);
      setHistory([]);
      setHistoryOwnerId("");
      updateStatus.current(errorMessage(error));
    }).finally(() => {
      if (isCurrent(sessionToken, detailRequest, token, request)) {
        setHistoryLoading(false);
      }
    });
  }, [
    host.token,
    operational,
    safeSelectedId,
    listSelected?.version,
  ]);

  function invalidateRefresh() {
    listRequest.current += 1;
    setRefreshing(false);
  }

  function applyDocumentType(documentType: ComplianceDocumentType) {
    invalidateRefresh();
    detailRequest.current += 1;
    setStateToken(host.token);
    setDocumentTypes((current) => [
      documentType,
      ...current.filter((row) => row.id !== documentType.id),
    ]);
    setSelectedId(documentType.id);
    setDetail(documentType);
    setHistory([]);
    setHistoryOwnerId("");
  }

  return {
    documentTypes: safeRows,
    selected,
    selectedId: safeSelectedId,
    setSelectedId,
    history: sessionMatches && historyOwnerId === safeSelectedId ? history : [],
    historyLoading: sessionMatches && historyLoading,
    refreshing: sessionMatches && refreshing,
    refreshDocumentTypes,
    invalidateRefresh,
    applyDocumentType,
  };
}

function isCurrent(
  sessionToken: { current: string },
  requestRef: { current: number },
  token: string,
  request: number,
) {
  return sessionToken.current === token && requestRef.current === request;
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Compliance Document Types request failed.";
}
