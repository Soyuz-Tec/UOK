import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ContactRecord,
  ContactGroupRecord,
  ContactSortBy,
  ContactSortDir,
  Dashboard,
  ModuleStatus,
  QualityReport
} from "../shared/types";
import { CONTACTS_MODULE_ID } from "../features/contacts/contactModule";

export type CommandResponse = { result: ContactRecord; status: string; idempotent?: boolean };

type WorkbenchFilters = {
  query: string;
  contactGroupId: string;
  statusFilter: string;
  reviewFilter: string;
  typeFilter: string;
  contactPage: number;
  contactPageSize: number;
  contactSortBy: ContactSortBy;
  contactSortDir: ContactSortDir;
};

function requestHeaders(token: string, overrideToken?: string) {
  const value: Record<string, string> = { "Content-Type": "application/json" };
  const activeToken = overrideToken ?? token;
  if (activeToken) value.Authorization = `Bearer ${activeToken}`;
  return value;
}

function contactsPath({ query, contactGroupId, statusFilter, reviewFilter, typeFilter, contactPage, contactPageSize, contactSortBy, contactSortDir }: WorkbenchFilters) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (contactGroupId) params.set("group_id", contactGroupId);
  if (statusFilter) params.set("status", statusFilter);
  if (reviewFilter !== "all") params.set("review_state", reviewFilter);
  if (typeFilter !== "all") params.set("party_type", typeFilter);
  params.set("limit", String(contactPageSize + 1));
  params.set("offset", String(contactPage * contactPageSize));
  params.set("sort_by", contactSortBy);
  params.set("sort_dir", contactSortDir);
  return `/api/contacts?${params.toString()}`;
}

export function useWorkbenchData(token: string, filters: WorkbenchFilters, onUnauthorized: () => void) {
  const [out, setOut] = useState<unknown>("Log in to begin.");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactGroups, setContactGroups] = useState<ContactGroupRecord[]>([]);
  const [contactHasNext, setContactHasNext] = useState(false);
  const [contactTotalCount, setContactTotalCount] = useState(0);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<ContactRecord | null>(null);
  const [modules, setModules] = useState<Record<string, ModuleStatus>>({});
  const [evidence, setEvidence] = useState<QualityReport | null>(null);
  const [alignment, setAlignment] = useState<QualityReport | null>(null);
  const [busyAction, setBusyAction] = useState<string>("");

  const moduleRows = useMemo(() => Object.values(modules).sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name)), [modules]);
  const contactsModule = modules[CONTACTS_MODULE_ID];
  const contactsOperational = contactsModule?.status === "installed" || contactsModule?.status === "upgraded";
  const selectedContact = selectedContactId
    ? selectedDetail?.id === selectedContactId
      ? selectedDetail
      : contacts.find((row) => row.id === selectedContactId) || null
    : null;

  const clearData = useCallback((message = "Signed out.") => {
    setDashboard(null);
    setContacts([]);
    setContactGroups([]);
    setContactHasNext(false);
    setContactTotalCount(0);
    setModules({});
    setEvidence(null);
    setAlignment(null);
    setSelectedContactId("");
    setSelectedDetail(null);
    setBusyAction("");
    setOut(message);
  }, []);

  const apiResponse = useCallback(async <T,>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<{ data: T; response: Response }> => {
    const res = await fetch(path, {
      ...options,
      headers: { ...requestHeaders(token, overrideToken), ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/register") {
        onUnauthorized();
        clearData("Session expired. Sign in again.");
      }
      throw data;
    }
    return { data: data as T, response: res };
  }, [clearData, onUnauthorized, token]);

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
    return (await apiResponse<T>(path, options, overrideToken)).data;
  }, [apiResponse]);

  const refresh = useCallback(async (overrideToken?: string) => {
    const activeToken = overrideToken ?? token;
    if (!activeToken) return;
    try {
      setBusyAction("refresh");
      const [dash, catalog, evidenceBody, alignmentBody] = await Promise.all([
        api<Dashboard>("/api/dashboard", {}, activeToken),
        api<{ modules: Record<string, ModuleStatus> }>("/api/modules/catalog", {}, activeToken),
        api<QualityReport>("/api/baseline-evidence", {}, activeToken),
        api<QualityReport>("/api/architecture/alignment", {}, activeToken)
      ]);
      const contactModuleStatus = catalog.modules[CONTACTS_MODULE_ID]?.status;
      const contactsReady = contactModuleStatus === "installed" || contactModuleStatus === "upgraded";
      const contactResult = contactsReady
        ? await apiResponse<ContactRecord[]>(contactsPath(filters), {}, activeToken)
        : null;
      const groupRows = contactsReady
        ? await api<ContactGroupRecord[]>("/api/contacts/groups", {}, activeToken)
        : [];
      const contactRows = contactResult?.data || [];
      const visibleRows = contactRows.slice(0, filters.contactPageSize);
      const contactTotal = contactResult
        ? contactTotalFromHeader(contactResult.response.headers?.get?.("X-Total-Count") ?? null, contactRows.length)
        : 0;
      setDashboard(dash);
      setContactHasNext(contactTotal > filters.contactPage * filters.contactPageSize + visibleRows.length || contactRows.length > filters.contactPageSize);
      setContactTotalCount(contactTotal);
      setContacts(visibleRows);
      setContactGroups(groupRows);
      setModules(catalog.modules);
      setEvidence(evidenceBody);
      setAlignment(alignmentBody);
      setOut({ status: "ready", counts: dash.counts });
    } catch (error) {
      setOut(error);
    } finally {
      setBusyAction("");
    }
  }, [api, apiResponse, filters, token]);

  const loadContactDetail = useCallback(async (partyId: string) => {
    if (!token || !partyId) {
      setSelectedDetail(null);
      return;
    }
    try {
      const detail = await api<ContactRecord>(`/api/contacts/${partyId}`);
      setSelectedDetail(detail);
    } catch (error) {
      setOut(error);
    }
  }, [api, token]);

  useEffect(() => {
    if (!token) return;
    void refresh();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [filters, refresh, token]);

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
    alignment,
    api,
    busyAction,
    clearData,
    contacts,
    contactGroups,
    contactHasNext,
    contactTotalCount,
    contactsModule,
    contactsOperational,
    dashboard,
    evidence,
    loadContactDetail,
    moduleRows,
    out,
    refresh,
    selectedContact,
    selectedContactId,
    setBusyAction,
    setOut,
    setSelectedContactId
  };
}

export type WorkbenchData = ReturnType<typeof useWorkbenchData>;

function contactTotalFromHeader(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
