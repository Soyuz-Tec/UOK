import { useCallback, useEffect, useState } from "react";

import type {
  ContactFilters,
  ContactGroupRecord,
  ContactRecord,
} from "../contracts";

export function useContactData(
  token: string,
  operational: boolean,
  filters: ContactFilters,
  onUnauthorized: () => void,
) {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroupRecord[]>([]);
  const [contactHasNext, setContactHasNext] = useState(false);
  const [contactTotalCount, setContactTotalCount] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<ContactRecord | null>(null);
  const [busyAction, setBusyAction] = useState("");
  const [out, setOut] = useState<unknown>(null);

  const selectedContact = selectedContactId
    ? selectedDetail?.id === selectedContactId
      ? selectedDetail
      : contacts.find((row) => row.id === selectedContactId) || null
    : null;

  const clearData = useCallback(() => {
    setContacts([]);
    setContactGroups([]);
    setContactHasNext(false);
    setContactTotalCount(0);
    setSelectedContactId("");
    setSelectedDetail(null);
    setBusyAction("");
    setOut(null);
  }, []);

  const apiResponse = useCallback(async <T,>(
    path: string,
    options: RequestInit = {},
  ): Promise<{ data: T; response: Response }> => {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...requestHeaders(token),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        onUnauthorized();
        clearData();
      }
      throw data;
    }
    return { data: data as T, response };
  }, [clearData, onUnauthorized, token]);

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}) => {
    return (await apiResponse<T>(path, options)).data;
  }, [apiResponse]);

  const refresh = useCallback(async () => {
    if (!token || !operational) return;
    try {
      setBusyAction("refresh");
      const [contactResult, groupRows] = await Promise.all([
        apiResponse<ContactRecord[]>(contactsPath(filters)),
        api<ContactGroupRecord[]>("/api/contacts/groups"),
      ]);
      const contactRows = contactResult.data;
      const visibleRows = contactRows.slice(0, filters.contactPageSize);
      const total = contactTotalFromHeader(
        contactResult.response.headers?.get?.("X-Total-Count") ?? null,
        contactRows.length,
      );
      setContactHasNext(
        total > filters.contactPage * filters.contactPageSize + visibleRows.length
          || contactRows.length > filters.contactPageSize
      );
      setContactTotalCount(total);
      setContacts(visibleRows);
      setContactGroups(groupRows);
      setOut({ status: "ready", count: visibleRows.length });
    } catch (error) {
      setOut(error);
    } finally {
      setBusyAction("");
    }
  }, [api, apiResponse, filters, operational, token]);

  const loadContactDetail = useCallback(async (partyId: string) => {
    if (!token || !operational || !partyId) {
      setSelectedDetail(null);
      return;
    }
    try {
      setSelectedDetail(await api<ContactRecord>(`/api/contacts/${partyId}`));
    } catch (error) {
      setOut(error);
    }
  }, [api, operational, token]);

  useEffect(() => {
    if (!token || !operational) {
      clearData();
      return;
    }
    void refresh();
  }, [token, operational]);

  useEffect(() => {
    if (!token || !operational) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters, operational, refresh, token]);

  useEffect(() => {
    if (contacts.length && (!selectedContactId || !contacts.some((row) => row.id === selectedContactId))) {
      setSelectedContactId(contacts[0].id);
    } else if (!contacts.length && selectedContactId) {
      setSelectedContactId("");
    }
  }, [contacts, selectedContactId]);

  useEffect(() => {
    void loadContactDetail(selectedContactId);
  }, [loadContactDetail, selectedContactId, token]);

  return {
    api,
    busyAction,
    contacts,
    contactGroups,
    contactHasNext,
    contactTotalCount,
    loadContactDetail,
    out,
    refresh,
    selectedContact,
    selectedContactId,
    setBusyAction,
    setOut,
    setSelectedContactId,
  };
}

export type ContactData = ReturnType<typeof useContactData>;

function requestHeaders(token: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function contactsPath(filters: ContactFilters) {
  const params = new URLSearchParams();
  if (filters.query) params.set("query", filters.query);
  if (filters.contactGroupId) params.set("group_id", filters.contactGroupId);
  if (filters.statusFilter) params.set("status", filters.statusFilter);
  if (filters.reviewFilter !== "all") params.set("review_state", filters.reviewFilter);
  if (filters.typeFilter !== "all") params.set("party_type", filters.typeFilter);
  if (filters.sourceFilter !== "all") params.set("source", filters.sourceFilter);
  if (filters.qualityFilter !== "all") params.set("quality", filters.qualityFilter);
  params.set("limit", String(filters.contactPageSize + 1));
  params.set("offset", String(filters.contactPage * filters.contactPageSize));
  params.set("sort_by", filters.contactSortBy);
  params.set("sort_dir", filters.contactSortDir);
  return `/api/contacts?${params.toString()}`;
}

function contactTotalFromHeader(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
