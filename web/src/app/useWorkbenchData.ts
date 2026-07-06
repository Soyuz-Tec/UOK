import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ContactRecord,
  Dashboard,
  ModuleStatus,
  QualityReport
} from "../shared/types";

export type CommandResponse = { result: ContactRecord; status: string; idempotent?: boolean };

type WorkbenchFilters = {
  query: string;
  statusFilter: string;
  reviewFilter: string;
  typeFilter: string;
};

function requestHeaders(token: string, overrideToken?: string) {
  const value: Record<string, string> = { "Content-Type": "application/json" };
  const activeToken = overrideToken ?? token;
  if (activeToken) value.Authorization = `Bearer ${activeToken}`;
  return value;
}

function contactsPath({ query, statusFilter, reviewFilter, typeFilter }: WorkbenchFilters) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (statusFilter) params.set("status", statusFilter);
  if (reviewFilter !== "all") params.set("review_state", reviewFilter);
  if (typeFilter !== "all") params.set("party_type", typeFilter);
  return `/api/contacts?${params.toString()}`;
}

export function useWorkbenchData(token: string, filters: WorkbenchFilters, onUnauthorized: () => void) {
  const [out, setOut] = useState<unknown>("Log in to begin.");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [reviewRows, setReviewRows] = useState<ContactRecord[]>([]);
  const [importBatches, setImportBatches] = useState<unknown[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<ContactRecord | null>(null);
  const [modules, setModules] = useState<Record<string, ModuleStatus>>({});
  const [evidence, setEvidence] = useState<QualityReport | null>(null);
  const [alignment, setAlignment] = useState<QualityReport | null>(null);
  const [busyAction, setBusyAction] = useState<string>("");

  const moduleRows = useMemo(() => Object.values(modules).sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name)), [modules]);
  const contactsModule = modules["contacts.core"];
  const contactsOperational = contactsModule?.status === "installed" || contactsModule?.status === "upgraded";
  const selectedContact = selectedDetail || contacts.find((row) => row.id === selectedContactId) || null;

  const clearData = useCallback((message = "Signed out.") => {
    setDashboard(null);
    setContacts([]);
    setReviewRows([]);
    setImportBatches([]);
    setModules({});
    setEvidence(null);
    setAlignment(null);
    setSelectedContactId("");
    setSelectedDetail(null);
    setBusyAction("");
    setOut(message);
  }, []);

  const api = useCallback(async <T,>(path: string, options: RequestInit = {}, overrideToken?: string): Promise<T> => {
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
    return data as T;
  }, [clearData, onUnauthorized, token]);

  const refresh = useCallback(async (overrideToken?: string) => {
    const activeToken = overrideToken ?? token;
    if (!activeToken) return;
    try {
      setBusyAction("refresh");
      const [dash, contactRows, reviewQueue, batches, catalog, evidenceBody, alignmentBody] = await Promise.all([
        api<Dashboard>("/api/dashboard", {}, activeToken),
        api<ContactRecord[]>(contactsPath(filters), {}, activeToken),
        api<ContactRecord[]>("/api/contacts/review-queue", {}, activeToken),
        api<unknown[]>("/api/contacts/import-batches", {}, activeToken),
        api<{ modules: Record<string, ModuleStatus> }>("/api/modules/catalog", {}, activeToken),
        api<QualityReport>("/api/baseline-evidence", {}, activeToken),
        api<QualityReport>("/api/architecture/alignment", {}, activeToken)
      ]);
      setDashboard(dash);
      setContacts(contactRows);
      setReviewRows(reviewQueue);
      setImportBatches(batches);
      setModules(catalog.modules);
      setEvidence(evidenceBody);
      setAlignment(alignmentBody);
      setOut({ status: "ready", counts: dash.counts });
    } catch (error) {
      setOut(error);
    } finally {
      setBusyAction("");
    }
  }, [api, filters, token]);

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
  }, [refresh, token]);

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
    contactsModule,
    contactsOperational,
    dashboard,
    evidence,
    importBatches,
    loadContactDetail,
    moduleRows,
    out,
    refresh,
    reviewRows,
    selectedContact,
    selectedContactId,
    setBusyAction,
    setOut,
    setSelectedContactId
  };
}

export type WorkbenchData = ReturnType<typeof useWorkbenchData>;
