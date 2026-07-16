import type { CalendarCapabilities, CalendarEventRecord } from "./calendarTypes";

export class CalendarApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
    readonly responseEtag: string | null,
  ) {
    super(calendarApiErrorMessage(payload, status));
    this.name = "CalendarApiError";
  }
}

export function calendarAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function calendarJson<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { ...calendarAuthHeaders(token), ...(options.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new CalendarApiError(response.status, body, response.headers.get("ETag"));
  return body as T;
}

export async function loadCalendarCapabilities(token: string): Promise<CalendarCapabilities> {
  return calendarJson<CalendarCapabilities>(token, "/api/calendar/capabilities");
}

export async function loadCalendarEventDetail(event: CalendarEventRecord, token: string, signal: AbortSignal) {
  const response = await fetch(`/api/calendar/events/${event.id}`, {
    headers: calendarAuthHeaders(token),
    signal,
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) throw new CalendarApiError(response.status, detail, response.headers.get("ETag"));
  const etag = response.headers.get("ETag");
  if (!etag) throw new Error("Calendar event detail did not include an update validator.");
  return { event: { ...event, ...(detail as CalendarEventRecord) }, etag };
}

export async function downloadCalendarIcs(token: string, params: URLSearchParams) {
  const response = await fetch(`/api/calendar/ics/export?${params.toString()}`, {
    headers: calendarAuthHeaders(token),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new CalendarApiError(response.status, body, response.headers.get("ETag"));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "uok-calendar.ics";
  link.click();
  URL.revokeObjectURL(url);
}

function calendarApiErrorMessage(payload: unknown, status: number) {
  if (!payload || typeof payload !== "object") return `Calendar request failed with HTTP ${status}.`;
  const row = payload as Record<string, unknown>;
  if (typeof row.detail === "string") return row.detail;
  if (row.detail && typeof row.detail === "object") {
    const detail = row.detail as Record<string, unknown>;
    if (typeof detail.error === "string") return detail.error;
    if (typeof detail.message === "string") return detail.message;
  }
  if (row.error && typeof row.error === "object") {
    const detail = row.error as Record<string, unknown>;
    const message = typeof detail.message === "string" ? detail.message : "";
    const repair = typeof detail.repair === "string" ? detail.repair : "";
    if (message || repair) return [message, repair].filter(Boolean).join(" ");
  }
  if (typeof row.message === "string") return row.message;
  return `Calendar request failed with HTTP ${status}.`;
}
