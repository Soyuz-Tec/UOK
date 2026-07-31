import { useCallback, useRef } from "react";

import type { RequestAuthority } from "@uok/shared/request-authority";
import type { beginComplianceRead } from "./complianceReadAuthority";
import {
  complianceReadErrorMessage,
  complianceReadsEnabled,
  supersedeComplianceReadLanes,
  type ComplianceReadBoundary,
} from "./complianceReadAuthority";
import {
  loadComplianceReconciliationSnapshot,
  mergeComplianceDocumentTypes,
  newerComplianceDocumentType,
  reconcileComplianceNameHistory,
  type ComplianceReconciliationSnapshot,
} from "./complianceReadReconciliation";
import type {
  ComplianceDocumentType,
  ComplianceDocumentTypeNameHistory,
} from "./types";

export type ComplianceReconciliationRequest = {
  preferredSelectedId?: string;
  preferenceIsCurrent?: () => boolean;
};

export type ComplianceReconciliationResult =
  | {
    kind: "applied";
    rows: ComplianceDocumentType[];
    preferenceCurrent: boolean;
  }
  | { kind: "deferred" }
  | { kind: "superseded" }
  | { kind: "failed"; error: unknown };

type CurrentSnapshot = {
  rows: ComplianceDocumentType[];
  selectedId: string;
  detail: ComplianceDocumentType | null;
  history: ComplianceDocumentTypeNameHistory[];
};

export function useComplianceDocumentTypeReconciliation({
  authority,
  boundaryRef,
  beginRead,
  current,
  onApplied,
  onRefreshing,
  onStatus,
}: {
  authority: RequestAuthority;
  boundaryRef: { current: ComplianceReadBoundary };
  beginRead: (lane: string) => ReturnType<typeof beginComplianceRead>;
  current: CurrentSnapshot;
  onApplied: (snapshot: ComplianceReconciliationSnapshot, epoch: number) => void;
  onRefreshing: (epoch: number, refreshing: boolean) => void;
  onStatus: (status: string) => void;
}) {
  const currentRef = useRef(current);
  const active = useRef(false);
  currentRef.current = current;

  const supersedeReadsForMutation = useCallback(() => {
    supersedeComplianceReadLanes(authority, ["list", "detail", "reconcile"]);
    onRefreshing(authority.epoch, false);
  }, [authority, onRefreshing]);

  const reconcileDocumentTypes = useCallback(async (
    request: ComplianceReconciliationRequest = {},
  ): Promise<ComplianceReconciliationResult> => {
    const boundary = boundaryRef.current;
    if (!complianceReadsEnabled(boundary)) return { kind: "deferred" };
    supersedeComplianceReadLanes(authority, ["list", "detail", "reconcile"]);
    const operation = beginRead("reconcile");
    active.current = true;
    onRefreshing(operation.ticket.epoch, true);
    try {
      const requestedPreferredSelectedId = request.preferenceIsCurrent?.()
        ? request.preferredSelectedId
        : undefined;
      const snapshot = await loadComplianceReconciliationSnapshot({
        token: boundary.token,
        request: operation.request,
        isCurrent: operation.isCurrent,
        currentSelectedId: currentRef.current.selectedId,
        preferredSelectedId: requestedPreferredSelectedId,
      });
      if (!snapshot || !operation.isCurrent()) return { kind: "superseded" };
      const preferenceCurrent = request.preferenceIsCurrent?.() ?? false;
      if (
        requestedPreferredSelectedId
        && snapshot.selectedId === requestedPreferredSelectedId
        && !preferenceCurrent
      ) return { kind: "superseded" };
      const merged = {
        ...snapshot,
        rows: mergeComplianceDocumentTypes(currentRef.current.rows, snapshot.rows),
        detail: newerComplianceDocumentType(
          currentRef.current.detail,
          snapshot.detail,
        ),
        history: reconcileComplianceNameHistory(
          currentRef.current.selectedId,
          currentRef.current.history,
          snapshot.selectedId,
          snapshot.history,
        ),
      };
      onApplied(merged, operation.ticket.epoch);
      onStatus(`${merged.rows.length} compliance document type(s) loaded.`);
      return { kind: "applied", rows: merged.rows, preferenceCurrent };
    } catch (error) {
      if (!operation.isCurrent()) return { kind: "superseded" };
      onStatus(complianceReadErrorMessage(error));
      return { kind: "failed", error };
    } finally {
      if (operation.isCurrent()) onRefreshing(operation.ticket.epoch, false);
      active.current = false;
      operation.ticket.release();
    }
  }, [
    authority,
    beginRead,
    boundaryRef,
    onApplied,
    onRefreshing,
    onStatus,
  ]);

  return {
    reconciliationActive: active,
    supersedeReadsForMutation,
    reconcileDocumentTypes,
  };
}
