import {
  ContactReadApiError,
  type ContactReadRequest,
} from "./contactReadApi";

export async function contactSecondaryReadJson<T>(
  token: string,
  path: string,
  request: ContactReadRequest,
  fallbackMessage: string,
): Promise<{ body: T; response: Response }> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal: request.signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) request.onUnauthorized();
    throw new ContactReadApiError(
      contactSecondaryReadErrorMessage(body, fallbackMessage),
      response.status,
      body,
    );
  }
  return { body: body as T, response };
}

function contactSecondaryReadErrorMessage(
  body: unknown,
  fallbackMessage: string,
) {
  if (body && typeof body === "object") {
    const value = body as Record<string, unknown>;
    if (typeof value.detail === "string") return value.detail;
    if (value.detail && typeof value.detail === "object") {
      const detail = value.detail as Record<string, unknown>;
      if (typeof detail.message === "string") return detail.message;
      if (typeof detail.error === "string") return detail.error;
    }
    if (value.error && typeof value.error === "object") {
      const error = value.error as Record<string, unknown>;
      if (typeof error.message === "string") return error.message;
    }
  }
  return fallbackMessage;
}

export function contactSecondaryTotalCount(
  value: string | null,
  fallback: number,
) {
  if (value === null || value.trim() === "") return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= fallback ? parsed : fallback;
}
