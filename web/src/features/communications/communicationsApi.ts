import type { CommunicationThread } from "./types";

export async function loadCommunicationThreads(token: string): Promise<CommunicationThread[]> {
  return communicationJson(token, "/api/communications/threads");
}

export async function loadCommunicationThread(token: string, threadId: string): Promise<CommunicationThread> {
  return communicationJson(token, `/api/communications/threads/${threadId}`);
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

async function communicationJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(communicationError(body));
  return body as T;
}

function communicationError(body: unknown) {
  if (body && typeof body === "object" && "detail" in body) return JSON.stringify(body.detail);
  return "Communication request failed.";
}
