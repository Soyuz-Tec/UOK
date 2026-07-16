import type { ContactGroupRecord, ContactRecord } from "./contracts";

export type ManagedContactGroup = ContactGroupRecord & {
  kind: "manual" | "business_domain" | "smart_rule";
  status: "active" | "archived" | string;
  etag: string;
  user_managed: boolean;
  can_delete: boolean;
  can_restore: boolean;
  updated_at?: string;
};

export type ContactGroupMemberRow = Pick<
  ContactRecord,
  "id" | "display_name" | "party_type" | "email" | "organization_name"
>;

export function createContactGroupsManagerApi(token: string) {
  const request = async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(contactGroupsApiError(body));
    return body as T;
  };

  return {
    groups: () => request<ManagedContactGroup[]>("/api/contacts/groups?include_empty=true&include_archived=true"),
    members: (groupId: string) => request<ContactGroupMemberRow[]>(contactsQuery({ group_id: groupId, limit: "200" })),
    candidates: (query: string) => request<ContactGroupMemberRow[]>(contactsQuery({ query, limit: "50" })),
    create: (payload: { name: string; description?: string }) => request<ManagedContactGroup>("/api/contacts/groups", jsonRequest("POST", payload)),
    update: (groupId: string, payload: { name: string; description: string }) => request<ManagedContactGroup>(`/api/contacts/groups/${encodeURIComponent(groupId)}`, jsonRequest("PATCH", payload)),
    archive: (groupId: string, etag: string) => request<ManagedContactGroup>(`/api/contacts/groups/${encodeURIComponent(groupId)}`, conditionalRequest("DELETE", etag)),
    restore: (groupId: string, etag: string) => request<ManagedContactGroup>(`/api/contacts/groups/${encodeURIComponent(groupId)}/restore`, conditionalRequest("POST", etag)),
    addMember: (groupId: string, partyId: string) => request<unknown>(`/api/contacts/groups/${encodeURIComponent(groupId)}/members`, jsonRequest("POST", { party_ids: [partyId] })),
    removeMember: (groupId: string, partyId: string) => request<unknown>(`/api/contacts/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(partyId)}`, { method: "DELETE" }),
    generateBusinessDomains: () => command(request, "GroupContactsByBusinessEmailDomain", { minimum_members: 2 }, "contact-group-domain"),
    generateSmartGroups: async () => {
      for (const rule of ["organization", "country", "party_type", "review_state", "source"]) {
        await command(request, "GroupContactsBySmartRule", { rule, minimum_members: 2 }, `contact-group-smart-${rule}`);
      }
    }
  };
}

function contactsQuery(extra: Record<string, string>) {
  const params = new URLSearchParams({
    status: "active",
    sort_by: "display_name",
    sort_dir: "asc",
    ...extra
  });
  return `/api/contacts?${params.toString()}`;
}

function jsonRequest(method: string, payload: unknown): RequestInit {
  return { method, body: JSON.stringify(payload) };
}

function conditionalRequest(method: string, etag: string): RequestInit {
  return { method, headers: { "If-Match": etag } };
}

async function command(
  request: <T>(path: string, options?: RequestInit) => Promise<T>,
  commandType: string,
  payload: Record<string, unknown>,
  idempotencyPrefix: string
) {
  return request<unknown>("/api/commands", jsonRequest("POST", {
    command_type: commandType,
    payload,
    idempotency_key: `${idempotencyPrefix}:${Date.now()}`
  }));
}

function contactGroupsApiError(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (detail && typeof detail === "object") {
      const structured = detail as { error?: unknown; message?: unknown; repair?: unknown };
      const message = typeof structured.message === "string" ? structured.message : "";
      const repair = typeof structured.repair === "string" ? structured.repair : "";
      if (message || repair) return [message, repair].filter(Boolean).join(" ");
      const error = structured.error;
      if (typeof error === "string") return error;
    }
  }
  return "Contact groups could not be updated.";
}
