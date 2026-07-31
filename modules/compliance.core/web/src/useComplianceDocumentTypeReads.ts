import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import { createRequestAuthority } from "@uok/shared/request-authority";
import {
  advanceComplianceDetailCriteria,
  beginComplianceRead,
  complianceDetailCriteria,
  complianceReadBoundary,
  complianceReadErrorMessage,
  complianceReadyStatus,
  complianceReadsEnabled,
  sameComplianceReadBoundary,
  selectComplianceDocumentTypeId,
  supersedeComplianceReadLane,
  type ComplianceReadBoundary,
} from "./complianceReadAuthority";
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
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  setStatus: (value: string) => void,
) {
  const [authority] = useState(createRequestAuthority);
  const token = host.session.token;
  const generation = host.session.generation;
  const role = host.currentUserRole;
  const surfaceActive = host.surfaceActive;
  const boundary = useMemo(
    () => complianceReadBoundary(
      token,
      generation,
      role,
      operational,
      surfaceActive,
    ),
    [generation, operational, role, surfaceActive, token],
  );
  const boundaryRef = useRef(boundary);
  const previousEffectBoundary = useRef<ComplianceReadBoundary | null>(null);
  const lastRefreshRevision = useRef(host.moduleRefreshRevision);
  const updateStatus = useRef(setStatus);
  const listStatus = useRef(complianceReadyStatus);
  const onUnauthorized = useRef(host.session.onUnauthorized);
  const [, renderInvalidation] = useState(0);
  const [listEpoch, setListEpoch] = useState(authority.epoch);
  const [documentTypes, setDocumentTypes] = useState<ComplianceDocumentType[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detailEpoch, setDetailEpoch] = useState(authority.epoch);
  const detailCriteriaRef = useRef({ value: "", generation: 0 });
  const [detailCriteriaGeneration, setDetailCriteriaGeneration] = useState(0);
  const [detail, setDetail] = useState<ComplianceDocumentType | null>(null);
  const [history, setHistory] = useState<ComplianceDocumentTypeNameHistory[]>([]);
  const [historyOwnerId, setHistoryOwnerId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({ epoch: authority.epoch, value: false });
  updateStatus.current = setStatus;
  onUnauthorized.current = host.session.onUnauthorized;

  useLayoutEffect(() => {
    if (sameComplianceReadBoundary(boundaryRef.current, boundary)) return;
    boundaryRef.current = boundary;
    authority.invalidate();
    listStatus.current = complianceReadyStatus;
    updateStatus.current(complianceReadyStatus);
    renderInvalidation((current) => current + 1);
  }, [authority, boundary]);

  const readEnabled = complianceReadsEnabled(boundary);
  const listCurrent = Boolean(readEnabled) && authority.isCurrentEpoch(listEpoch);
  const safeRows = listCurrent ? documentTypes : [];
  const safeSelectedId = listCurrent ? selectedId : "";
  const listSelected = safeRows.find((row) => row.id === safeSelectedId) || null;
  const detailCriteria = complianceDetailCriteria(safeSelectedId, listSelected?.version);
  const detailCurrent = Boolean(readEnabled)
    && authority.isCurrentEpoch(detailEpoch)
    && detailCriteriaGeneration === detailCriteriaRef.current.generation;
  const selected = detailCurrent && detail?.id === safeSelectedId ? detail : listSelected;

  useLayoutEffect(() => {
    if (detailCriteriaRef.current.value === detailCriteria) return;
    advanceComplianceDetailCriteria(authority, detailCriteriaRef, detailCriteria);
    updateStatus.current(listStatus.current);
    renderInvalidation((current) => current + 1);
  }, [authority, detailCriteria]);

  const beginRead = useCallback((lane: string) => {
    return beginComplianceRead(
      authority,
      boundaryRef,
      onUnauthorized,
      () => {
        listStatus.current = complianceReadyStatus;
        updateStatus.current(complianceReadyStatus);
        renderInvalidation((current) => current + 1);
      },
      lane,
    );
  }, [authority]);

  const refreshDocumentTypes = useCallback(async () => {
    const current = boundaryRef.current;
    if (!current.token || !current.operational || !current.surfaceActive) return;
    const request = beginRead("list");
    setRefreshing({ epoch: request.ticket.epoch, value: true });
    try {
      const rows = await loadComplianceDocumentTypes(current.token, request.request);
      if (!request.isCurrent()) return;
      setListEpoch(request.ticket.epoch);
      setDocumentTypes(rows);
      setSelectedId((selectedIdValue) => (
        selectComplianceDocumentTypeId(rows, selectedIdValue)
      ));
      const status = `${rows.length} compliance document type(s) loaded.`;
      listStatus.current = status;
      updateStatus.current(status);
    } catch (error) {
      if (request.isCurrent()) {
        const status = complianceReadErrorMessage(error);
        listStatus.current = status;
        updateStatus.current(status);
      }
    } finally {
      if (request.isCurrent()) {
        setRefreshing({ epoch: request.ticket.epoch, value: false });
      }
      request.ticket.release();
    }
  }, [beginRead]);

  useEffect(() => {
    const boundaryChanged = !previousEffectBoundary.current
      || !sameComplianceReadBoundary(previousEffectBoundary.current, boundary);
    const refreshRequested = lastRefreshRevision.current !== host.moduleRefreshRevision;
    previousEffectBoundary.current = boundary;
    lastRefreshRevision.current = host.moduleRefreshRevision;
    if (boundaryChanged) {
      setListEpoch(authority.epoch);
      setDocumentTypes([]);
      setSelectedId("");
      setDetailEpoch(authority.epoch);
      setDetail(null);
      setHistory([]);
      setHistoryOwnerId("");
      setHistoryLoading(false);
      setRefreshing({ epoch: authority.epoch, value: false });
    }
    if ((boundaryChanged || refreshRequested) && complianceReadsEnabled(boundary)) {
      void refreshDocumentTypes();
    }
  }, [authority, boundary, host.moduleRefreshRevision, refreshDocumentTypes]);

  useEffect(() => {
    const current = boundaryRef.current;
    const request = beginRead("detail");
    const criteriaGeneration = detailCriteriaRef.current.generation;
    setDetailEpoch(request.ticket.epoch);
    setDetailCriteriaGeneration(criteriaGeneration);
    setDetail(null);
    setHistory([]);
    setHistoryOwnerId("");
    if (!complianceReadsEnabled(current) || !safeSelectedId) {
      setHistoryLoading(false);
      request.ticket.release();
      return;
    }
    setHistoryLoading(true);
    void Promise.all([
      loadComplianceDocumentType(current.token, safeSelectedId, request.request),
      loadComplianceDocumentTypeNameHistory(
        current.token,
        safeSelectedId,
        request.request,
      ),
    ]).then(([documentType, rows]) => {
      if (!request.isCurrent()) return;
      setDetail(documentType);
      setHistory(rows);
      setHistoryOwnerId(safeSelectedId);
    }).catch((error) => {
      if (!request.isCurrent()) return;
      setDetail(null);
      setHistory([]);
      setHistoryOwnerId("");
      updateStatus.current(complianceReadErrorMessage(error));
    }).finally(() => {
      if (request.isCurrent()) setHistoryLoading(false);
      request.ticket.release();
    });
  }, [beginRead, listSelected?.version, safeSelectedId]);

  useEffect(() => () => {
    authority.dispose();
  }, [authority]);

  function invalidateRefresh() {
    supersedeComplianceReadLane(authority, "list");
    setRefreshing({ epoch: authority.epoch, value: false });
  }

  function applyDocumentType(documentType: ComplianceDocumentType) {
    supersedeComplianceReadLane(authority, "list");
    const criteriaGeneration = advanceComplianceDetailCriteria(
      authority,
      detailCriteriaRef,
      complianceDetailCriteria(documentType.id, documentType.version),
    );
    setListEpoch(authority.epoch);
    setDocumentTypes((current) => [
      documentType,
      ...current.filter((row) => row.id !== documentType.id),
    ]);
    setSelectedId(documentType.id);
    setDetailEpoch(authority.epoch);
    setDetailCriteriaGeneration(criteriaGeneration);
    setDetail(documentType);
    setHistory([]);
    setHistoryOwnerId("");
    setHistoryLoading(false);
    setRefreshing({ epoch: authority.epoch, value: false });
  }

  return {
    documentTypes: safeRows,
    selected,
    selectedId: safeSelectedId,
    setSelectedId,
    history: detailCurrent && historyOwnerId === safeSelectedId ? history : [],
    historyLoading: detailCurrent && historyLoading,
    refreshing: listCurrent
      && refreshing.epoch === authority.epoch
      && refreshing.value,
    refreshDocumentTypes,
    invalidateRefresh,
    applyDocumentType,
  };
}
