import type {
  ContactFilters,
  ContactGroupRecord,
  ContactRecord,
} from "../contracts";

type UnauthorizedHandler = () => void;

export type ContactReadRequest = {
  onUnauthorized: UnauthorizedHandler;
  signal?: AbortSignal;
};

export type ContactListResult = {
  rows: ContactRecord[];
  totalCount: number;
  hasNext: boolean;
};

export async function loadContacts(
  token: string,
  filters: ContactFilters,
  request: ContactReadRequest,
): Promise<ContactListResult> {
  const { body, response } = await contactReadJson<unknown>(
    token,
    contactsPath(filters),
    request,
  );
  if (!Array.isArray(body)) {
    throw new ContactReadApiError(
      "Contacts list response was invalid.",
      response.status,
      body,
    );
  }
  const rows = body as ContactRecord[];
  const visibleRows = rows.slice(0, filters.contactPageSize);
  const totalCount = contactTotalFromHeader(
    response.headers?.get?.("X-Total-Count") ?? null,
    rows.length,
  );
  return {
    rows: visibleRows,
    totalCount,
    hasNext: totalCount
      > filters.contactPage * filters.contactPageSize + visibleRows.length
      || rows.length > filters.contactPageSize,
  };
}

export async function loadContactGroups(
  token: string,
  request: ContactReadRequest,
) {
  const { body, response } = await contactReadJson<unknown>(
    token,
    "/api/contacts/groups",
    request,
  );
  if (!Array.isArray(body)) {
    throw new ContactReadApiError(
      "Contacts groups response was invalid.",
      response.status,
      body,
    );
  }
  return body as ContactGroupRecord[];
}

export async function loadContactDetail(
  token: string,
  partyId: string,
  request: ContactReadRequest,
) {
  const { body, response } = await contactReadJson<unknown>(
    token,
    `/api/contacts/${encodeURIComponent(partyId)}`,
    request,
  );
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ContactReadApiError(
      "Contact detail response was invalid.",
      response.status,
      body,
    );
  }
  return body as ContactRecord;
}

async function contactReadJson<T>(
  token: string,
  path: string,
  request: ContactReadRequest,
): Promise<{ body: T; response: Response }> {
  const response = await fetch(path, {
    headers: requestHeaders(token),
    signal: request.signal,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) request.onUnauthorized();
    throw new ContactReadApiError(
      contactReadErrorMessage(body, response.status),
      response.status,
      body,
    );
  }
  return { body: body as T, response };
}

export class ContactReadApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ContactReadApiError";
  }
}

export function contactReadErrorMessage(
  value: unknown,
  status?: number,
) {
  if (value instanceof Error) return value.message;
  if (value && typeof value === "object") {
    const body = value as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    if (body.detail && typeof body.detail === "object") {
      const detail = body.detail as Record<string, unknown>;
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.error === "string") return detail.error;
    }
    if (body.error && typeof body.error === "object") {
      const error = body.error as Record<string, unknown>;
      if (typeof error.message === "string") return error.message;
    }
  }
  return status === undefined
    ? "Contacts request failed."
    : `Contacts request failed with HTTP ${status}.`;
}

function requestHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
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
