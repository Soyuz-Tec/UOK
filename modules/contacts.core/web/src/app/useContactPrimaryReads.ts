import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { ModuleSurfaceRenderContext } from "@uok/contracts/moduleSurface";

import type { ContactFilters } from "../contracts";
import {
  advanceContactDetailCriteria, advanceContactListCriteria,
  contactDetailCriteria, contactListCriteria, contactReadOutcomeCurrent,
  contactReadsEnabled, emptyContactDetailCommit, emptyContactGroupsCommit,
  emptyContactListCommit, emptyContactLoadingCommit, selectContactId,
  type ContactDetailCommit, type ContactGroupsCommit,
  type ContactListCommit, type ContactLoadingCommit,
} from "./contactReadAuthority";
import {
  contactDetailLoadCurrent,
  contactRefreshCallbackCurrent,
} from "./contactReadGuards";
import {
  contactReadErrorMessage, loadContactDetail as loadContactDetailRequest,
  loadContactGroups, loadContacts,
} from "./contactReadApi";
import { useContactReadBoundary } from "./useContactReadBoundary";
import { useContactReadOutcome } from "./useContactReadOutcome";
import { useContactReadScheduling } from "./useContactReadScheduling";
import { useContactPrimaryReconciliation,
  type ContactPrimaryReconciliationSnapshot } from "./useContactPrimaryReconciliation";

export function useContactPrimaryReads(
  host: ModuleSurfaceRenderContext,
  operational: boolean,
  filters: ContactFilters,
) {
  const { authority, boundary, boundaryRef, beginRead } =
    useContactReadBoundary(host, operational);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const listCriteriaValue = contactListCriteria(filters);
  const listCriteriaRef = useRef({ value: listCriteriaValue, generation: 0 });
  const detailCriteriaRef = useRef({ value: contactDetailCriteria(""), generation: 0 });
  const [, renderInvalidation] = useState(0);
  const [listCommit, setListCommit] =
    useState<ContactListCommit>(() => emptyContactListCommit(authority.epoch));
  const listCommitRef = useRef(listCommit);
  listCommitRef.current = listCommit;
  const [groupsCommit, setGroupsCommit] =
    useState<ContactGroupsCommit>(() => emptyContactGroupsCommit(authority.epoch));
  const [selection, setSelectionState] = useState({ epoch: authority.epoch, id: "" });
  const selectionRef = useRef(selection);
  const [detailCommit, setDetailCommit] =
    useState<ContactDetailCommit>(() => emptyContactDetailCommit(authority.epoch));
  const [listLoading, setListLoading] =
    useState<ContactLoadingCommit>(() => emptyContactLoadingCommit(authority.epoch));
  const [groupsLoading, setGroupsLoading] = useState({
    epoch: authority.epoch, value: false,
  });
  const { clearAllReadOutcomes, clearReadOutcome, outcome, setReadOutcome } =
    useContactReadOutcome(authority);
  const readEnabled = contactReadsEnabled(boundary);
  const listCurrent = readEnabled
    && authority.isCurrentEpoch(listCommit.epoch)
    && listCommit.criteriaGeneration === listCriteriaRef.current.generation;
  const contacts = listCurrent ? listCommit.rows : [];
  const selectedContactId = listCurrent && authority.isCurrentEpoch(selection.epoch)
    ? selection.id
    : "";
  const listSelected = contacts.find((row) => row.id === selectedContactId) || null;
  const detailCriteriaValue = contactDetailCriteria(
    selectedContactId,
    listSelected?.updated_at,
  );
  const detailCurrent = readEnabled
    && authority.isCurrentEpoch(detailCommit.epoch)
    && detailCommit.criteriaGeneration === detailCriteriaRef.current.generation
    && detailCommit.ownerId === selectedContactId
    && detailCommit.ownerUpdatedAt === (listSelected?.updated_at ?? "")
    && detailCommit.row?.id === selectedContactId;
  const groupsCurrent = readEnabled && authority.isCurrentEpoch(groupsCommit.epoch);

  useLayoutEffect(() => {
    if (listCriteriaRef.current.value === listCriteriaValue) return;
    advanceContactListCriteria(authority, listCriteriaRef, listCriteriaValue);
    renderInvalidation((current) => current + 1);
  }, [authority, listCriteriaValue]);

  useLayoutEffect(() => {
    if (detailCriteriaRef.current.value === detailCriteriaValue) return;
    advanceContactDetailCriteria(authority, detailCriteriaRef, detailCriteriaValue);
    renderInvalidation((current) => current + 1);
  }, [authority, detailCriteriaValue]);

  const setSelectedContactId = useCallback((id: string) => {
    const next = { epoch: authority.epoch, id };
    selectionRef.current = next;
    setSelectionState(next);
  }, [authority]);

  const applyReconciliation = useCallback((
    snapshot: ContactPrimaryReconciliationSnapshot,
    epoch: number,
    criteriaGeneration: number,
  ) => {
    const selectedRow = snapshot.list.rows.find((row) => row.id === snapshot.selectedId);
    const detailGeneration = advanceContactDetailCriteria(
      authority,
      detailCriteriaRef,
      contactDetailCriteria(snapshot.selectedId, selectedRow?.updated_at),
    );
    const nextList = { epoch, criteriaGeneration, ...snapshot.list };
    const nextSelection = { epoch, id: snapshot.selectedId };
    listCommitRef.current = nextList;
    selectionRef.current = nextSelection;
    setListCommit(nextList);
    setGroupsCommit({ epoch, rows: snapshot.groups });
    setSelectionState(nextSelection);
    setDetailCommit({
      epoch,
      criteriaGeneration: detailGeneration,
      ownerId: snapshot.selectedId,
      ownerUpdatedAt: selectedRow?.updated_at ?? "",
      row: snapshot.detail,
    });
    clearAllReadOutcomes();
  }, [authority, clearAllReadOutcomes]);
  const setReconciliationRefreshing = useCallback((
    epoch: number,
    criteriaGeneration: number,
    value: boolean,
  ) => {
    setListLoading({ epoch, criteriaGeneration, value });
    setGroupsLoading({ epoch, value });
  }, []);
  const reconciliation = useContactPrimaryReconciliation({
    authority,
    beginRead,
    boundaryRef,
    detailCriteriaRef,
    filtersRef,
    listCriteriaRef,
    selectionRef,
    onApplied: applyReconciliation,
    onRefreshing: setReconciliationRefreshing,
  });

  const refreshContacts = useCallback(async () => {
    const current = boundaryRef.current;
    if (!contactReadsEnabled(current)) return;
    const currentFilters = filtersRef.current;
    if (contactListCriteria(currentFilters) !== listCriteriaRef.current.value) return;
    const criteriaGeneration = listCriteriaRef.current.generation;
    const request = beginRead("list");
    const isCurrent = () => request.isCurrent()
      && criteriaGeneration === listCriteriaRef.current.generation;
    setListLoading({ epoch: request.ticket.epoch, criteriaGeneration, value: true });
    try {
      const result = await loadContacts(current.token, currentFilters, request.request);
      if (!isCurrent()) return;
      setListCommit({ epoch: request.ticket.epoch, criteriaGeneration, ...result });
      const currentId = authority.isCurrentEpoch(selectionRef.current.epoch)
        ? selectionRef.current.id
        : "";
      const next = {
        epoch: request.ticket.epoch,
        id: selectContactId(result.rows, currentId),
      };
      selectionRef.current = next;
      setSelectionState(next);
      setReadOutcome("list", criteriaGeneration, {
        status: "ready", count: result.rows.length,
      });
    } catch (error) {
      if (isCurrent()) {
        setReadOutcome("list", criteriaGeneration, contactReadErrorMessage(error));
      }
    } finally {
      if (isCurrent()) {
        setListLoading({ epoch: request.ticket.epoch, criteriaGeneration, value: false });
      }
      request.ticket.release();
    }
  }, [authority, beginRead, boundaryRef, setReadOutcome]);

  const refreshGroups = useCallback(async () => {
    const current = boundaryRef.current;
    if (!contactReadsEnabled(current)) return;
    const request = beginRead("groups");
    setGroupsLoading({ epoch: request.ticket.epoch, value: true });
    try {
      const rows = await loadContactGroups(current.token, request.request);
      if (request.isCurrent()) {
        setGroupsCommit({ epoch: request.ticket.epoch, rows });
        clearReadOutcome("groups", request.ticket.epoch, 0);
      }
    } catch (error) {
      if (request.isCurrent()) {
        setReadOutcome("groups", 0, contactReadErrorMessage(error));
      }
    } finally {
      if (request.isCurrent()) {
        setGroupsLoading({ epoch: request.ticket.epoch, value: false });
      }
      request.ticket.release();
    }
  }, [beginRead, boundaryRef, clearReadOutcome, setReadOutcome]);

  const loadContactDetail = useCallback(async (partyId: string) => {
    const current = boundaryRef.current;
    const currentSelection = selectionRef.current;
    const currentList = listCommitRef.current;
    if (!contactDetailLoadCurrent(
      authority, current, currentList, currentSelection,
      listCriteriaRef.current.generation, partyId,
    )) return;
    const selectedRow = currentList.rows.find((row) => row.id === partyId);
    const criteriaValue = contactDetailCriteria(partyId, selectedRow?.updated_at);
    if (detailCriteriaRef.current.value !== criteriaValue) {
      advanceContactDetailCriteria(authority, detailCriteriaRef, criteriaValue);
      renderInvalidation((value) => value + 1);
    }
    const criteriaGeneration = detailCriteriaRef.current.generation;
    const ownerUpdatedAt = selectedRow?.updated_at ?? "";
    const request = beginRead("detail");
    const isCurrent = () => request.isCurrent()
      && criteriaGeneration === detailCriteriaRef.current.generation
      && authority.isCurrentEpoch(selectionRef.current.epoch)
      && selectionRef.current.id === partyId;
    setDetailCommit({ epoch: request.ticket.epoch, criteriaGeneration,
      ownerId: partyId, ownerUpdatedAt, row: null });
    try {
      const row = await loadContactDetailRequest(current.token, partyId, request.request);
      if (isCurrent()) {
        setDetailCommit({
          epoch: request.ticket.epoch, criteriaGeneration,
          ownerId: partyId, ownerUpdatedAt, row,
        });
        clearReadOutcome("detail", request.ticket.epoch, criteriaGeneration);
      }
    } catch (error) {
      if (isCurrent()) {
        setReadOutcome("detail", criteriaGeneration, contactReadErrorMessage(error));
      }
    } finally {
      request.ticket.release();
    }
  }, [authority, beginRead, boundaryRef, clearReadOutcome, setReadOutcome]);

  const refreshCurrent = useCallback(async () => {
    await Promise.allSettled([refreshContacts(), refreshGroups()]);
  }, [refreshContacts, refreshGroups]);
  const refreshEpoch = authority.epoch;
  const refreshCriteriaGeneration = listCriteriaRef.current.generation;
  const refresh = useCallback(async () => {
    if (!contactRefreshCallbackCurrent(
      authority, boundaryRef, boundary, refreshEpoch, listCriteriaRef.current,
      listCriteriaValue, refreshCriteriaGeneration,
    )) return;
    await refreshCurrent();
  }, [
    authority, boundary, boundaryRef, listCriteriaValue,
    refreshCriteriaGeneration, refreshCurrent, refreshEpoch,
  ]);
  useContactReadScheduling({
    authority,
    boundary,
    moduleRefreshRevision: host.moduleRefreshRevision,
    listCriteriaValue,
    detailCriteriaValue,
    selectedContactId,
    refresh: refreshCurrent,
    refreshContacts,
    loadContactDetail,
  });

  const refreshing = (listLoading.value
      && authority.isCurrentEpoch(listLoading.epoch)
      && listLoading.criteriaGeneration === listCriteriaRef.current.generation)
    || (groupsLoading.value && authority.isCurrentEpoch(groupsLoading.epoch));
  const outcomeCurrent = outcome && contactReadOutcomeCurrent(
    authority, outcome, listCriteriaRef.current.generation,
    detailCriteriaRef.current.generation,
  );
  return {
    contactMutationInteraction: { criteriaGeneration: listCriteriaRef.current.generation,
      selectionGeneration: detailCriteriaRef.current.generation, selectedId: selectedContactId,
      selectedRevision: listSelected?.updated_at ?? "" },
    contacts,
    contactGroups: groupsCurrent ? groupsCommit.rows : [],
    contactHasNext: listCurrent ? listCommit.hasNext : false,
    contactTotalCount: listCurrent ? listCommit.totalCount : 0,
    loadContactDetail,
    out: outcomeCurrent ? outcome.value : null,
    refresh,
    refreshing,
    reconcilePrimaryContacts: reconciliation.reconcilePrimaryContacts,
    selectedContact: detailCurrent ? detailCommit.row : listSelected,
    selectedContactId,
    setSelectedContactId,
    supersedeReadsForMutation: reconciliation.supersedeReadsForMutation,
  };
}
