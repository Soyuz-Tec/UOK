import { useEffect, useRef, useState } from "react";

import { CalendarApiError, calendarJson, loadCalendarCapabilities } from "./calendarClient";
import { durationDays, rangeForView } from "./calendarDates";
import type { CalendarCapabilities, CalendarEventRecord, CalendarRecord, CalendarView } from "./calendarTypes";
import { calendarErrorMessage } from "./CalendarWorkspaceSupport";

const noCapabilities: CalendarCapabilities = { read: false, manage: false, create: false, delete: false, restore: false };

export function useCalendarCatalog({
  token,
  operational,
  timezone,
  view,
  cursorDate,
  onRefreshStart,
  onDeleteSuccess,
}: {
  token: string;
  operational: boolean;
  timezone: string;
  view: CalendarView;
  cursorDate: Date;
  onRefreshStart: () => void;
  onDeleteSuccess: (calendar: CalendarRecord) => void;
}) {
  const [calendars, setCalendars] = useState<CalendarRecord[]>([]);
  const [deletedCalendars, setDeletedCalendars] = useState<CalendarRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<CalendarCapabilities>(noCapabilities);
  const [calendarBusyAction, setCalendarBusyAction] = useState("");
  const [busyCount, setBusyCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [workspaceError, setWorkspaceError] = useState("");
  const refreshSequence = useRef(0);
  const api = <T,>(path: string, options: RequestInit = {}) => calendarJson<T>(token, path, options);

  function setWorkspaceStatus(text: string) {
    setStatusMessage(text);
    setWorkspaceError("");
  }

  function setWorkspaceFailure(error: unknown) {
    setWorkspaceError(calendarErrorMessage(error));
  }

  async function refreshCalendar(calendarId?: string) {
    onRefreshStart();
    const requestId = ++refreshSequence.current;
    if (!token || !operational) return;
    try {
      const rows = await api<CalendarRecord[]>(capabilities.manage
        ? "/api/calendar/calendars?include_deleted=true"
        : "/api/calendar/calendars");
      const activeRows = rows.filter((row) => row.status !== "deleted");
      const deletedRows = rows.filter((row) => row.status === "deleted");
      const requested = calendarId ?? activeCalendarId;
      const nextId = requested === null
        ? activeRows[0]?.id || ""
        : requested === "" || activeRows.some((row) => row.id === requested) ? requested : activeRows[0]?.id || "";
      let nextEvents: CalendarEventRecord[] = [];
      let nextBusyCount = 0;
      const range = rangeForView(view, cursorDate);
      if (activeRows.length) {
        const params = new URLSearchParams({ from_at: range.from.toISOString(), to_at: range.to.toISOString(), include_canceled: "true" });
        if (nextId) params.set("calendar_id", nextId);
        const [eventResult, freebusy] = await Promise.all([
          api<CalendarEventRecord[]>(`/api/calendar/events?${params.toString()}`),
          api<{ busy: unknown[] }>(`/api/calendar/freebusy?${params.toString()}`),
        ]);
        nextEvents = eventResult;
        nextBusyCount = freebusy.busy.length;
      }
      if (requestId !== refreshSequence.current) return;
      setCalendars(activeRows);
      setDeletedCalendars(deletedRows);
      setActiveCalendarId(nextId);
      setEvents(nextEvents);
      setBusyCount(nextBusyCount);
      setWorkspaceStatus(`Loaded ${activeRows.length} active calendars, ${deletedRows.length} deleted calendars, and ${durationDays(range.from, range.to)} visible days.`);
    } catch (error) {
      if (requestId === refreshSequence.current) setWorkspaceFailure(error);
    }
  }

  async function createCalendar() {
    if (!capabilities.create || calendarBusyAction) return;
    setCalendarBusyAction("create");
    try {
      const row = await api<CalendarRecord>("/api/calendar/calendars", {
        method: "POST",
        body: JSON.stringify({ name: calendars.length ? `Calendar ${calendars.length + 1}` : "Default Calendar", timezone, visibility_scope: "organization" }),
      });
      await refreshCalendar(row.id);
      setWorkspaceStatus(`Created ${row.name}.`);
    } catch (error) {
      setWorkspaceFailure(error);
    } finally {
      setCalendarBusyAction("");
    }
  }

  async function deleteCalendar(calendar: CalendarRecord) {
    if (!capabilities.delete || calendar.user_managed !== true || calendar.can_delete !== true || calendarBusyAction) return;
    if (!calendar.etag) throw new Error("Reload the Calendar list before deleting this calendar.");
    setCalendarBusyAction(`delete:${calendar.id}`);
    try {
      await api(`/api/calendar/calendars/${calendar.id}`, {
        method: "DELETE",
        headers: { "If-Match": calendar.etag },
      });
      onDeleteSuccess(calendar);
      await refreshCalendar();
      setWorkspaceStatus(`Deleted ${calendar.name}. Its events remain retained for audit.`);
    } catch (error) {
      if (error instanceof CalendarApiError && (error.status === 412 || error.status === 428)) await refreshCalendar();
      setWorkspaceFailure(error);
      throw error;
    } finally {
      setCalendarBusyAction("");
    }
  }

  async function restoreCalendar(calendar: CalendarRecord) {
    if (!capabilities.restore || calendar.user_managed !== true || calendar.can_restore !== true || calendarBusyAction) return;
    if (!calendar.etag) throw new Error("Reload the Calendar list before restoring this calendar.");
    setCalendarBusyAction(`restore:${calendar.id}`);
    try {
      await api(`/api/calendar/calendars/${calendar.id}/restore`, {
        method: "POST",
        headers: { "If-Match": calendar.etag },
      });
      await refreshCalendar(calendar.id);
      setWorkspaceStatus(`Restored ${calendar.name}. Its retained events are active again.`);
    } catch (error) {
      if (error instanceof CalendarApiError && (error.status === 412 || error.status === 428)) await refreshCalendar();
      setWorkspaceFailure(error);
      throw error;
    } finally {
      setCalendarBusyAction("");
    }
  }

  useEffect(() => {
    let active = true;
    if (!token || !operational) setCapabilities(noCapabilities);
    else void loadCalendarCapabilities(token)
      .then((value) => { if (active) setCapabilities(value); })
      .catch(() => { if (active) setCapabilities(noCapabilities); });
    return () => { active = false; };
  }, [token, operational]);

  useEffect(() => {
    void refreshCalendar();
    return onRefreshStart;
  }, [token, operational, view, cursorDate, capabilities.manage]);

  return {
    activeCalendarId, api, busyCount, calendarBusyAction, calendars, capabilities, deletedCalendars,
    createCalendar, deleteCalendar, events, refreshCalendar, restoreCalendar, setStatusMessage,
    setWorkspaceFailure, setWorkspaceStatus, statusMessage, workspaceError,
  };
}
