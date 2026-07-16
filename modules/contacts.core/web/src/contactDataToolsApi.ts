import type { ContactGroupRecord, ContactRecord } from "./contracts";

export type ContactFactRow = {
  id: string;
  fact_type: string;
  label: string;
  value: string;
  is_primary: boolean;
  is_verified: boolean;
  source: string;
  confidence: string;
  created_at?: string;
  updated_at?: string;
};

export type ContactConsentRow = {
  id: string;
  purpose: string;
  channel: string;
  status: string;
  legal_basis: string;
  allowed_use: string;
  source: string;
  effective_at: string;
  expires_at?: string | null;
  recorded_by_user_id?: string;
};

export type ContactTeamMemberRow = {
  id: string;
  user_id: string;
  role: "owner" | "manager" | "member" | "viewer" | string;
  status: string;
};

export type ContactTeamRow = {
  id: string;
  name: string;
  description: string;
  status: string;
  member_count: number;
  members: ContactTeamMemberRow[];
  etag: string;
  revision: number;
  user_managed: boolean;
  can_delete: boolean;
  can_restore: boolean;
};

export type ContactImportResult = {
  batch_id: string;
  dry_run?: boolean;
  status?: string;
  imported_count?: number;
  updated_count?: number;
  failed_count?: number;
  validated_count?: number;
  skipped_count?: number;
  result_truncated?: boolean;
  rolled_back_count?: number;
  already_rolled_back?: boolean;
};

export type ContactImportRow = {
  id: string;
  row_number: number;
  requested_operation: string;
  applied_operation: string;
  status: string;
  party_id?: string | null;
  error_message?: string;
};

export type ContactDuplicateCandidateRow = {
  id: string;
  left_party_id: string;
  right_party_id: string;
  left_name: string;
  right_name: string;
  score: number;
  reasons: string[];
  status: string;
  updated_at?: string;
};

export type ContactCustomFieldDefinition = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "choice" | "url" | string;
  applies_to: "all" | "person" | "organization" | string;
  required: boolean;
  options?: string[];
  status: string;
  etag: string;
  revision: number;
  user_managed: boolean;
  can_delete: boolean;
  can_restore: boolean;
};

export type ContactCustomFieldValue = {
  id: string;
  field_definition_id: string;
  field_key: string;
  label: string;
  field_type: string;
  value: unknown;
};

export type ContactExternalIdentity = {
  id: string;
  provider: string;
  external_id: string;
  sync_state: string;
  conflict_state: string;
  last_synced_at?: string | null;
};

export type ContactInteroperabilityStatus = {
  formats: Record<string, { import: boolean; export: boolean }>;
  providers: Array<{ id: string; adapter: string; configured: boolean }>;
  sync_claim: string;
};

export type ContactFactWrite = Omit<ContactFactRow, "id" | "created_at" | "updated_at"> & {
  details?: Record<string, unknown>;
};

export type ContactConsentWrite = {
  purpose: string;
  channel: string;
  status: string;
  legal_basis: string;
  allowed_use: string;
  source: string;
  effective_at?: string | null;
  expires_at?: string | null;
  evidence?: Record<string, unknown>;
};

export type ContactDownload = {
  blob: Blob;
  filename: string;
  restrictedCount: number;
};

export function createContactDataToolsApi(token: string) {
  const request = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers });
    const body = await readResponseBody(response);
    if (!response.ok) throw new Error(contactDataToolsApiError(body, response.status));
    return body as T;
  };

  const command = async <T,>(commandType: string, payload: Record<string, unknown>, key: string): Promise<T> => {
    const envelope = await request<{ result?: T }>("/api/commands", jsonRequest("POST", {
      command_type: commandType,
      payload,
      idempotency_key: `${key}:${Date.now()}`,
    }));
    return (envelope.result ?? envelope) as T;
  };

  const download = async (format: "csv" | "vcf", partyIds: string[]): Promise<ContactDownload> => {
    const params = new URLSearchParams();
    for (const partyId of partyIds) params.append("party_id", partyId);
    const response = await fetch(`/api/contacts/export.${format}${params.size ? `?${params}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const body = await readResponseBody(response);
      throw new Error(contactDataToolsApiError(body, response.status));
    }
    return {
      blob: await response.blob(),
      filename: format === "csv" ? "uok-contacts.csv" : "uok-contacts.vcf",
      restrictedCount: Number(response.headers.get("X-Consent-Restricted-Count") || 0),
    };
  };

  return {
    facts: (partyId: string) => request<ContactFactRow[]>(`/api/contacts/${encodeURIComponent(partyId)}/facts`),
    addFact: (partyId: string, payload: ContactFactWrite) => request<ContactFactRow>(`/api/contacts/${encodeURIComponent(partyId)}/facts`, jsonRequest("POST", payload)),
    updateFact: (partyId: string, factId: string, payload: ContactFactWrite) => request<ContactFactRow>(`/api/contacts/${encodeURIComponent(partyId)}/facts/${encodeURIComponent(factId)}`, jsonRequest("PATCH", payload)),
    removeFact: (partyId: string, factId: string) => request<unknown>(`/api/contacts/${encodeURIComponent(partyId)}/facts/${encodeURIComponent(factId)}`, { method: "DELETE" }),
    consents: (partyId: string) => request<ContactConsentRow[]>(`/api/contacts/${encodeURIComponent(partyId)}/consents`),
    recordConsent: (partyId: string, payload: ContactConsentWrite) => request<ContactConsentRow>(`/api/contacts/${encodeURIComponent(partyId)}/consents`, jsonRequest("POST", payload)),
    teams: () => request<ContactTeamRow[]>("/api/contacts/teams?include_archived=true"),
    createTeam: (payload: { name: string; description: string }) => request<ContactTeamRow>("/api/contacts/teams", jsonRequest("POST", payload)),
    updateTeam: (teamId: string, payload: { name: string; description: string }) => request<ContactTeamRow>(`/api/contacts/teams/${encodeURIComponent(teamId)}`, jsonRequest("PATCH", payload)),
    deleteTeam: (teamId: string, etag: string, reason: string) => request<ContactTeamRow>(`/api/contacts/teams/${encodeURIComponent(teamId)}`, conditionalJsonRequest("DELETE", { reason }, etag)),
    restoreTeam: (teamId: string, etag: string) => request<ContactTeamRow>(`/api/contacts/teams/${encodeURIComponent(teamId)}/restore`, conditionalRequest("POST", etag)),
    addTeamMember: (teamId: string, payload: { user_id: string; role: string }) => request<unknown>(`/api/contacts/teams/${encodeURIComponent(teamId)}/members`, jsonRequest("POST", payload)),
    removeTeamMember: (teamId: string, userId: string) => request<unknown>(`/api/contacts/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`, { method: "DELETE" }),
    importCsv: (payload: { filename: string; csv_text: string; dry_run: boolean; mode: string; mapping: Record<string, string> }) => request<ContactImportResult>("/api/contacts/import-csv", jsonRequest("POST", payload)),
    importVcard: (payload: { vcard_text: string; dry_run: boolean }) => request<ContactImportResult>("/api/contacts/import-vcard", jsonRequest("POST", payload)),
    importRows: (batchId: string) => request<ContactImportRow[]>(`/api/contacts/import-batches/${encodeURIComponent(batchId)}/rows`),
    rollbackImport: (batchId: string) => request<ContactImportResult>(`/api/contacts/import-batches/${encodeURIComponent(batchId)}/rollback`, { method: "POST" }),
    exportContacts: download,
    bulk: (partyIds: string[], action: string, value?: string) => request<{ affected_count: number }>("/api/contacts/bulk", jsonRequest("POST", { party_ids: partyIds, action, value: value || null })),
    duplicates: (status = "open") => request<ContactDuplicateCandidateRow[]>(`/api/contacts/duplicate-candidates?status=${encodeURIComponent(status)}`),
    refreshDuplicates: () => request<{ candidate_count: number }>("/api/contacts/duplicate-candidates/refresh", { method: "POST" }),
    resolveDuplicate: (candidateId: string, status: "not_duplicate" | "ignored", expectedUpdatedAt?: string) => request<ContactDuplicateCandidateRow>(`/api/contacts/duplicate-candidates/${encodeURIComponent(candidateId)}/resolve`, jsonRequest("POST", { status, expected_updated_at: expectedUpdatedAt || null })),
    mergeDuplicate: (primaryPartyId: string, duplicatePartyId: string) => command<ContactRecord>("MergeDuplicateContact", { primary_party_id: primaryPartyId, duplicate_party_id: duplicatePartyId }, "contact-data-merge"),
    rollbackMerge: (primaryPartyId: string, duplicatePartyId: string, mergeId: string) => command<ContactRecord>("RollbackDuplicateMerge", { primary_party_id: primaryPartyId, duplicate_party_id: duplicatePartyId, merge_id: mergeId }, "contact-data-merge-rollback"),
    customFields: (includeArchived = true) => request<ContactCustomFieldDefinition[]>(`/api/contacts/custom-fields${includeArchived ? "?include_archived=true" : ""}`),
    defineCustomField: (payload: { field_key: string; label: string; field_type: string; applies_to: string; required: boolean; options: string[] }) => request<ContactCustomFieldDefinition>("/api/contacts/custom-fields", jsonRequest("POST", payload)),
    deleteCustomField: (definitionId: string, etag: string, reason: string) => request<ContactCustomFieldDefinition>(`/api/contacts/custom-fields/${encodeURIComponent(definitionId)}`, conditionalJsonRequest("DELETE", { reason }, etag)),
    restoreCustomField: (definitionId: string, etag: string) => request<ContactCustomFieldDefinition>(`/api/contacts/custom-fields/${encodeURIComponent(definitionId)}/restore`, conditionalRequest("POST", etag)),
    customValues: (partyId: string) => request<ContactCustomFieldValue[]>(`/api/contacts/${encodeURIComponent(partyId)}/custom-fields`),
    setCustomValue: (partyId: string, definitionId: string, value: unknown) => request<ContactCustomFieldValue>(`/api/contacts/${encodeURIComponent(partyId)}/custom-fields/${encodeURIComponent(definitionId)}`, jsonRequest("PUT", { value })),
    interoperability: () => request<ContactInteroperabilityStatus>("/api/contacts/interoperability"),
    externalIdentities: (partyId: string) => request<ContactExternalIdentity[]>(`/api/contacts/${encodeURIComponent(partyId)}/external-identities`),
    linkExternalIdentity: (partyId: string, payload: { provider: string; external_id: string; sync_state: string }) => request<ContactExternalIdentity>(`/api/contacts/${encodeURIComponent(partyId)}/external-identities`, jsonRequest("POST", payload)),
  };
}

export type ContactDataToolsApi = ReturnType<typeof createContactDataToolsApi>;

export type ContactDataToolsContext = {
  contacts: ContactRecord[];
  groups: ContactGroupRecord[];
};

function jsonRequest(method: string, payload: unknown): RequestInit {
  return { method, body: JSON.stringify(payload) };
}

function conditionalJsonRequest(method: string, payload: unknown, etag: string): RequestInit {
  return { method, body: JSON.stringify(payload), headers: { "If-Match": etag } };
}

function conditionalRequest(method: string, etag: string): RequestInit {
  return { method, headers: { "If-Match": etag } };
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function contactDataToolsApiError(body: unknown, status: number) {
  if (typeof body === "string" && body.trim()) return body;
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    const parsed = structuredContactError(detail);
    if (parsed) return parsed;
  }
  const parsed = structuredContactError(body);
  if (parsed) return parsed;
  return `Contacts request failed (${status}).`;
}

function structuredContactError(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const candidate = "error" in value ? (value as { error?: unknown }).error : value;
  if (typeof candidate === "string") return candidate;
  if (!candidate || typeof candidate !== "object") return "";
  const message = "message" in candidate && typeof candidate.message === "string" ? candidate.message : "";
  const repair = "repair" in candidate && typeof candidate.repair === "string" ? candidate.repair : "";
  return [message, repair].filter(Boolean).join(" ");
}
