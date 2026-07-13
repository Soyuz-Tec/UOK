import type { CalendarEventRecord } from "./calendarTypes";

export function calendarAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function loadCalendarEventDetail(event: CalendarEventRecord, token: string, signal: AbortSignal) {
  const response = await fetch(`/api/calendar/events/${event.id}`, {
    headers: calendarAuthHeaders(token),
    signal,
  });
  const detail = await response.json().catch(() => ({}));
  if (!response.ok) throw detail;
  const etag = response.headers.get("ETag");
  if (!etag) throw new Error("Calendar event detail did not include an update validator.");
  return { event: { ...event, ...(detail as CalendarEventRecord) }, etag };
}

export async function downloadCalendarIcs(token: string, params: URLSearchParams) {
  const response = await fetch(`/api/calendar/ics/export?${params.toString()}`, {
    headers: calendarAuthHeaders(token),
  });
  if (!response.ok) {
    throw await response.json().catch(() => ({ message: `Calendar export failed (${response.status}).` }));
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "uok-calendar.ics";
  link.click();
  URL.revokeObjectURL(url);
}
