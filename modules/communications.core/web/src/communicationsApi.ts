import type { CommunicationCapabilities, CommunicationThread } from "./types";

export async function loadCommunicationCapabilities(token: string): Promise<CommunicationCapabilities> {
  return communicationJson(token, "/api/communications/capabilities");
}

export async function loadCommunicationThreads(token: string, lifecycle: "active" | "archived" | "all" = "active"): Promise<CommunicationThread[]> {
  const rows = await communicationJson<unknown>(token, `/api/communications/threads?lifecycle=${encodeURIComponent(lifecycle)}`);
  if (!Array.isArray(rows) || !rows.every(isCommunicationThread)) {
    throw invalidCommunicationResponse("The K Connect thread list response was invalid.");
  }
  return rows;
}

export async function loadCommunicationThread(token: string, threadId: string, includeArchived = false): Promise<CommunicationThread> {
  const suffix = includeArchived ? "?include_archived=true" : "";
  const thread = await communicationJson<unknown>(token, `/api/communications/threads/${encodeURIComponent(threadId)}${suffix}`);
  if (!isCommunicationThread(thread)) {
    throw invalidCommunicationResponse("The K Connect thread response was invalid.");
  }
  return thread;
}

export async function createCommunicationThread(token: string, payload: { title: string; context_type?: string; context_id?: string | null }): Promise<CommunicationThread> {
  const response = await communicationJson<{ result: CommunicationThread }>(token, "/api/commands", {
    method: "POST",
    body: JSON.stringify({
      command_type: "CreateCommunicationThread",
      payload,
      idempotency_key: `communication-thread:${crypto.randomUUID()}`,
    }),
  });
  return response.result;
}

export async function deleteCommunicationThread(token: string, thread: CommunicationThread): Promise<CommunicationThread> {
  return communicationJson(token, `/api/communications/threads/${encodeURIComponent(thread.id)}`, {
    method: "DELETE",
    headers: { "If-Match": thread.etag },
  });
}

export async function restoreCommunicationThread(token: string, thread: CommunicationThread): Promise<CommunicationThread> {
  return communicationJson(token, `/api/communications/threads/${encodeURIComponent(thread.id)}/restore`, {
    method: "POST",
    headers: { "If-Match": thread.etag },
  });
}

async function communicationJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw communicationApiError(body, response.status, response.headers.get("ETag"));
  return body as T;
}

export class CommunicationApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code = "communication_request_failed",
    readonly repair = "",
    readonly reloadUrl = "",
    readonly currentEtag = "",
  ) {
    super(message);
    this.name = "CommunicationApiError";
  }

  get stale() {
    return this.status === 412 || this.status === 428;
  }
}

function invalidCommunicationResponse(message: string) {
  return new CommunicationApiError(message, 502, "communication_invalid_response", "Refresh K Connect after the service contract is repaired.");
}

function isCommunicationThread(value: unknown): value is CommunicationThread {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const thread = value as Record<string, unknown>;
  const status = thread.status;
  const restoreStatus = thread.restore_status;
  const lifecycleValid = status === "archived"
    ? restoreStatus === "open" || restoreStatus === "closed"
    : (status === "open" || status === "closed") && restoreStatus === null;
  return lifecycleValid
    && typeof thread.id === "string"
    && typeof thread.title === "string"
    && Number.isInteger(thread.revision)
    && Number(thread.revision) >= 1
    && typeof thread.etag === "string"
    && typeof thread.context_type === "string"
    && (thread.context_id === null || typeof thread.context_id === "string")
    && typeof thread.created_by_user_id === "string"
    && typeof thread.created_at === "string"
    && typeof thread.updated_at === "string"
    && (thread.correlation_id === undefined || typeof thread.correlation_id === "string");
}

function communicationApiError(body: unknown, status: number, currentEtag: string | null) {
  if (body && typeof body === "object" && "error" in body) {
    const error = body.error;
    if (error && typeof error === "object") {
      return new CommunicationApiError(
        "message" in error ? String(error.message) : "Communication request failed.",
        status,
        "code" in error ? String(error.code) : undefined,
        "repair" in error ? String(error.repair) : undefined,
        "reload_url" in error ? String(error.reload_url) : undefined,
        currentEtag || ("current_etag" in error ? String(error.current_etag) : ""),
      );
    }
  }
  const message = body && typeof body === "object" && "detail" in body
    ? JSON.stringify(body.detail)
    : "Communication request failed.";
  return new CommunicationApiError(message, status, undefined, undefined, undefined, currentEtag || "");
}
