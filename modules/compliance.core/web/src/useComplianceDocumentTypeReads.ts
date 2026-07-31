import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";
import {
  advanceComplianceDetailCriteria, complianceDetailCriteria,
  complianceReadErrorMessage,
  complianceReadsEnabled, sameComplianceReadBoundary, selectComplianceDocumentTypeId,
  type ComplianceReadBoundary,
} from "./complianceReadAuthority";
import type { ComplianceReconciliationSnapshot } from "./complianceReadReconciliation";
import {
  loadComplianceDocumentType, loadComplianceDocumentTypeNameHistory,
  loadComplianceDocumentTypes,
} from "./complianceApi";
import type {
  ComplianceDocumentType, ComplianceDocumentTypeNameHistory,
} from "./types";
import { useComplianceDocumentTypeReconciliation } from "./useComplianceDocumentTypeReconciliation";
import { useComplianceReadBoundary } from "./useComplianceReadBoundary";

export function useComplianceDocumentTypeReads(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  setStatus: (value: string) => void,
) {
  const {
    authority,
    boundary,
    boundaryRef,
    beginRead,
    listStatus,
    updateStatus,
  } = useComplianceReadBoundary(host, operational, setStatus);
  const previousEffectBoundary = useRef<ComplianceReadBoundary | null>(null);
  const lastRefreshRevision = useRef(host.moduleRefreshRevision);
  const [, renderInvalidation] = useState(0);
  const [listEpoch, setListEpoch] = useState(authority.epoch);
  const [documentTypes, setDocumentTypes] = useState<ComplianceDocumentType[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detailEpoch, setDetailEpoch] = useState(authority.epoch);
  const detailCriteriaRef = useRef({ value: "", generation: 0 });
  const reconciledDetailCriteria = useRef("");
  const [detailCriteriaGeneration, setDetailCriteriaGeneration] = useState(0);
  const [detail, setDetail] = useState<ComplianceDocumentType | null>(null);
  const [history, setHistory] = useState<ComplianceDocumentTypeNameHistory[]>([]);
  const [historyOwnerId, setHistoryOwnerId] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState({ epoch: authority.epoch, value: false });
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
  const safeHistory = detailCurrent && historyOwnerId === safeSelectedId ? history : [];

  useLayoutEffect(() => {
    if (detailCriteriaRef.current.value === detailCriteria) return;
    advanceComplianceDetailCriteria(authority, detailCriteriaRef, detailCriteria);
    updateStatus.current(listStatus.current);
    renderInvalidation((current) => current + 1);
  }, [authority, detailCriteria, listStatus, updateStatus]);

  const applyReconciliation = useCallback((
    snapshot: ComplianceReconciliationSnapshot,
    epoch: number,
  ) => {
    const selectedRow = snapshot.rows.find((row) => row.id === snapshot.selectedId);
    const criteria = complianceDetailCriteria(
      snapshot.selectedId,
      snapshot.detail?.version ?? selectedRow?.version,
    );
    const criteriaGeneration = detailCriteriaRef.current.value === criteria
      ? detailCriteriaRef.current.generation
      : detailCriteriaRef.current.generation + 1;
    detailCriteriaRef.current = { value: criteria, generation: criteriaGeneration };
    reconciledDetailCriteria.current = criteria;
    setListEpoch(epoch);
    setDocumentTypes(snapshot.rows);
    setSelectedId(snapshot.selectedId);
    setDetailEpoch(epoch);
    setDetailCriteriaGeneration(criteriaGeneration);
    setDetail(snapshot.detail);
    setHistory(snapshot.history);
    setHistoryOwnerId(snapshot.selectedId);
    setHistoryLoading(false);
  }, []);
  const onReconciliationStatus = useCallback((status: string) => {
    listStatus.current = status;
    updateStatus.current(status);
  }, [listStatus, updateStatus]);
  const onReconciliationRefreshing = useCallback(
    (epoch: number, value: boolean) => setRefreshing({ epoch, value }),
    [],
  );
  const reconciliation = useComplianceDocumentTypeReconciliation({
    authority,
    boundaryRef,
    beginRead,
    current: {
      rows: safeRows,
      selectedId: safeSelectedId,
      detail: selected,
      history: safeHistory,
    },
    onApplied: applyReconciliation,
    onRefreshing: onReconciliationRefreshing,
    onStatus: onReconciliationStatus,
  });

  const refreshDocumentTypes = useCallback(async () => {
    const current = boundaryRef.current;
    if (
      !current.token
      || !current.operational
      || !current.surfaceActive
      || reconciliation.reconciliationActive.current
    ) return;
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
  }, [
    beginRead,
    boundaryRef,
    listStatus,
    reconciliation.reconciliationActive,
    updateStatus,
  ]);

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
    if (reconciledDetailCriteria.current === detailCriteria) {
      reconciledDetailCriteria.current = "";
      return;
    }
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
  }, [
    beginRead,
    boundaryRef,
    detailCriteria,
    listSelected?.version,
    safeSelectedId,
    updateStatus,
  ]);

  useEffect(() => () => {
    authority.dispose();
  }, [authority]);

  return {
    documentTypes: safeRows,
    selected,
    selectedId: safeSelectedId,
    setSelectedId,
    history: safeHistory,
    historyLoading: detailCurrent && historyLoading,
    refreshing: listCurrent
      && refreshing.epoch === authority.epoch
      && refreshing.value,
    refreshDocumentTypes,
    supersedeReadsForMutation: reconciliation.supersedeReadsForMutation,
    reconcileDocumentTypes: reconciliation.reconcileDocumentTypes,
  };
}
