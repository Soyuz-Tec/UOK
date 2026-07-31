import { useEffect, useRef } from "react";

import type { RequestAuthority } from "@uok/shared/request-authority";

import {
  contactReadsEnabled,
  sameContactReadBoundary,
  type ContactReadBoundary,
} from "./contactReadAuthority";

export function useContactReadScheduling({
  authority,
  boundary,
  moduleRefreshRevision,
  listCriteriaValue,
  detailCriteriaValue,
  selectedContactId,
  refresh,
  refreshContacts,
  loadContactDetail,
}: {
  authority: RequestAuthority;
  boundary: ContactReadBoundary;
  moduleRefreshRevision: number;
  listCriteriaValue: string;
  detailCriteriaValue: string;
  selectedContactId: string;
  refresh: () => Promise<void>;
  refreshContacts: () => Promise<void>;
  loadContactDetail: (partyId: string) => Promise<void>;
}) {
  const refreshRef = useRef(refresh);
  const refreshContactsRef = useRef(refreshContacts);
  const previousBoundary = useRef<ContactReadBoundary | null>(null);
  const lastRefreshRevision = useRef(moduleRefreshRevision);
  const lastScheduledCriteria = useRef(listCriteriaValue);
  refreshRef.current = refresh;
  refreshContactsRef.current = refreshContacts;

  useEffect(() => {
    const boundaryChanged = !previousBoundary.current
      || !sameContactReadBoundary(previousBoundary.current, boundary);
    const refreshRequested = lastRefreshRevision.current !== moduleRefreshRevision;
    previousBoundary.current = boundary;
    lastRefreshRevision.current = moduleRefreshRevision;
    if (boundaryChanged || refreshRequested) {
      lastScheduledCriteria.current = listCriteriaValue;
      if (contactReadsEnabled(boundary)) void refreshRef.current();
    }
  }, [boundary, listCriteriaValue, moduleRefreshRevision]);

  useEffect(() => {
    if (lastScheduledCriteria.current === listCriteriaValue) return;
    lastScheduledCriteria.current = listCriteriaValue;
    if (!contactReadsEnabled(boundary)) return;
    const timer = window.setTimeout(() => void refreshContactsRef.current(), 250);
    return () => window.clearTimeout(timer);
  }, [boundary, listCriteriaValue]);

  useEffect(() => {
    if (selectedContactId) void loadContactDetail(selectedContactId);
  }, [detailCriteriaValue, loadContactDetail, selectedContactId]);

  useEffect(() => () => {
    authority.dispose();
  }, [authority]);
}
