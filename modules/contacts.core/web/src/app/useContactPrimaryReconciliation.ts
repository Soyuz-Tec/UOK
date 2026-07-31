import { useCallback, useRef } from "react";

import type { RequestAuthority } from "@uok/shared/request-authority";

import type { ContactFilters, ContactGroupRecord, ContactRecord } from "../contracts";
import type { beginContactRead, ContactReadBoundary } from "./contactReadAuthority";
import {
  contactListCriteria,
  contactReadsEnabled,
  selectContactId,
  supersedeContactReadLanes,
} from "./contactReadAuthority";
import {
  ContactReadApiError,
  loadContactDetail,
  loadContactGroups,
  loadContacts,
  type ContactListResult,
} from "./contactReadApi";

export type ContactPrimaryReconciliationRequest = {
  preferredSelectedId?: string;
  preferenceIsCurrent?: () => boolean;
};

export type ContactPrimaryReconciliationResult =
  | { kind: "applied"; preferenceCurrent: boolean; selectedId: string }
  | { kind: "deferred" }
  | { kind: "superseded" }
  | { kind: "failed"; error: unknown };

export type ContactPrimaryReconciliationSnapshot = {
  list: ContactListResult;
  groups: ContactGroupRecord[];
  selectedId: string;
  detail: ContactRecord | null;
};

export function useContactPrimaryReconciliation({
  authority,
  beginRead,
  boundaryRef,
  filtersRef,
  detailCriteriaRef,
  listCriteriaRef,
  selectionRef,
  onApplied,
  onRefreshing,
}: {
  authority: RequestAuthority;
  beginRead: (lane: string) => ReturnType<typeof beginContactRead>;
  boundaryRef: { current: ContactReadBoundary };
  filtersRef: { current: ContactFilters };
  detailCriteriaRef: { current: { value: string; generation: number } };
  listCriteriaRef: { current: { value: string; generation: number } };
  selectionRef: { current: { epoch: number; id: string } };
  onApplied: (
    snapshot: ContactPrimaryReconciliationSnapshot,
    epoch: number,
    criteriaGeneration: number,
  ) => void;
  onRefreshing: (epoch: number, criteriaGeneration: number, value: boolean) => void;
}) {
  const activeRef = useRef(false);

  const supersedeReadsForMutation = useCallback(() => {
    supersedeContactReadLanes(authority, ["list", "groups", "detail", "reconcile"]);
    onRefreshing(authority.epoch, listCriteriaRef.current.generation, false);
  }, [authority, listCriteriaRef, onRefreshing]);

  const reconcilePrimaryContacts = useCallback(async (
    request: ContactPrimaryReconciliationRequest = {},
  ): Promise<ContactPrimaryReconciliationResult> => {
    const boundary = boundaryRef.current;
    if (!contactReadsEnabled(boundary)) return { kind: "deferred" };
    if (activeRef.current) return { kind: "superseded" };
    const filters = filtersRef.current;
    if (contactListCriteria(filters) !== listCriteriaRef.current.value) {
      return { kind: "superseded" };
    }
    const criteriaGeneration = listCriteriaRef.current.generation;
    const requestedPreferredId = request.preferenceIsCurrent?.()
      ? request.preferredSelectedId
      : undefined;
    supersedeContactReadLanes(authority, ["list", "groups", "detail", "reconcile"]);
    const operation = beginRead("reconcile");
    let unauthorized = false;
    const readRequest = {
      ...operation.request,
      onUnauthorized: () => {
        unauthorized = true;
        operation.request.onUnauthorized();
      },
    };
    activeRef.current = true;
    onRefreshing(operation.ticket.epoch, criteriaGeneration, true);
    try {
      const [list, groups] = await Promise.all([
        loadContacts(boundary.token, filters, readRequest),
        loadContactGroups(boundary.token, readRequest),
      ]);
      if (!operation.isCurrent()
        || criteriaGeneration !== listCriteriaRef.current.generation) {
        return { kind: "superseded" };
      }
      const selectionSnapshot = { ...selectionRef.current };
      const selectionGeneration = detailCriteriaRef.current.generation;
      const currentSelection = authority.isCurrentEpoch(selectionSnapshot.epoch)
        ? selectionSnapshot.id
        : "";
      const selectedId = selectContactId(
        list.rows,
        requestedPreferredId || currentSelection,
      );
      const detail = selectedId
        ? await loadContactDetail(boundary.token, selectedId, readRequest)
        : null;
      if (!operation.isCurrent()
        || criteriaGeneration !== listCriteriaRef.current.generation
        || selectionGeneration !== detailCriteriaRef.current.generation
        || selectionSnapshot.epoch !== selectionRef.current.epoch
        || selectionSnapshot.id !== selectionRef.current.id) {
        return { kind: "superseded" };
      }
      const preferenceCurrent = request.preferenceIsCurrent?.() ?? false;
      if (requestedPreferredId
        && selectedId === requestedPreferredId
        && !preferenceCurrent) {
        return { kind: "superseded" };
      }
      onApplied(
        { list, groups, selectedId, detail },
        operation.ticket.epoch,
        criteriaGeneration,
      );
      return { kind: "applied", preferenceCurrent, selectedId };
    } catch (error) {
      if (unauthorized
        || (error instanceof ContactReadApiError && error.status === 401)) {
        return { kind: "deferred" };
      }
      return operation.isCurrent()
        ? { kind: "failed", error }
        : { kind: "superseded" };
    } finally {
      if (operation.isCurrent()) {
        onRefreshing(operation.ticket.epoch, criteriaGeneration, false);
      }
      activeRef.current = false;
      operation.ticket.release();
    }
  }, [
    authority,
    beginRead,
    boundaryRef,
    detailCriteriaRef,
    filtersRef,
    listCriteriaRef,
    onApplied,
    onRefreshing,
    selectionRef,
  ]);

  return {
    reconcilePrimaryContacts,
    supersedeReadsForMutation,
  };
}
