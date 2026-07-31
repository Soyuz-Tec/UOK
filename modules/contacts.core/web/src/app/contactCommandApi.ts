import type { ContactCommandResponse } from "../contracts";

export async function contactCommandApi<T>(
  token: string,
  onUnauthorized: () => void,
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...requestHeaders(token),
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) onUnauthorized();
    throw body;
  }
  return body as T;
}

export type ContactCommandRequest = Readonly<{
  idempotencyKey: string;
  onUnauthorized: () => void;
}>;

export async function executeContactCommand(
  token: string,
  commandType: string,
  payload: Record<string, unknown>,
  request: ContactCommandRequest,
) {
  let response: Response;
  try {
    response = await fetch("/api/commands", {
      method: "POST",
      headers: requestHeaders(token),
      body: JSON.stringify({
        command_type: commandType,
        payload,
        idempotency_key: request.idempotencyKey,
      }),
    });
  } catch (error) {
    throw new ContactCommandApiError(
      "The Contacts command outcome is unknown; reconciliation is required.",
      0,
      error,
      true,
    );
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) request.onUnauthorized();
    throw new ContactCommandApiError(
      contactCommandErrorMessage(body, response.status),
      response.status,
      body,
      response.status >= 500,
    );
  }
  if (!isContactCommandResponse(body)) {
    throw new ContactCommandApiError(
      "The Contacts command response was invalid; reconciliation is required.",
      response.status,
      body,
      true,
    );
  }
  return body;
}

export class ContactCommandApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
    readonly ambiguous = false,
  ) {
    super(message);
    this.name = "ContactCommandApiError";
  }
}

export function isContactCommandApiError(
  error: unknown,
): error is ContactCommandApiError {
  return error instanceof ContactCommandApiError;
}

export function contactCommandResultId(result: unknown) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return "";
  const row = result as Record<string, unknown>;
  return typeof row.id === "string"
    ? row.id
    : typeof row.contact_id === "string" ? row.contact_id : "";
}

function requestHeaders(token: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function isContactCommandResponse(value: unknown): value is ContactCommandResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return row.status === "succeeded"
    && typeof row.idempotent === "boolean"
    && "result" in row
    && (row.command_id === undefined || typeof row.command_id === "string");
}

function contactCommandErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const row = body as Record<string, unknown>;
    if (typeof row.detail === "string") return row.detail;
    if (row.detail && typeof row.detail === "object") {
      const detail = row.detail as Record<string, unknown>;
      if (typeof detail.message === "string") return detail.message;
    }
    if (row.error && typeof row.error === "object") {
      const error = row.error as Record<string, unknown>;
      if (typeof error.message === "string") return error.message;
    }
  }
  return `Contacts command failed with HTTP ${status}.`;
}
