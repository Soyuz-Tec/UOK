import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState } from "@uok/shared/data-display";
import type { ModuleStatus } from "@uok/shared/types";
import { CalendarAgendaView } from "./CalendarAgendaView";
import { CalendarEventEditor } from "./CalendarEventEditor";
import { CalendarMiniMonth } from "./CalendarMiniMonth";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarModuleState, calendarErrorMessage } from "./CalendarWorkspaceSupport";
import { calendarAuthHeaders, downloadCalendarIcs, loadCalendarEventDetail } from "./calendarClient";
import { resolveCalendarDraftTiming } from "./calendarDraftTiming";
import { CALENDAR_MODULE_ID } from "./calendarModule";
import { addDays, addMonths, durationDays, eventStart, rangeForView, startOfDay } from "./calendarDates";
import { draftFromEvent, emptyDraft, eventPayload } from "./calendarDrafts";
import { filterCalendarEvents } from "./calendarFilters";
import { calendarColorMap } from "./calendarPresentation";
import type { CalendarDraft, CalendarEventRecord, CalendarRecord, CalendarView } from "./calendarTypes";
import { LatestRequestGuard } from "./latestRequestGuard";

type Props = {
  token: string;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onInstall: () => void;
};

export function CalendarWorkspace({ token, moduleRows, busyAction, onInstall }: Props) {
  const module = moduleRows.find((row) => row.name === CALENDAR_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [calendars, setCalendars] = useState<CalendarRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null);
  const [view, setView] = useState<CalendarView>("month");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [cursorDate, setCursorDate] = useState(startOfDay(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRecord | undefined>();
  const [selectedEventEtag, setSelectedEventEtag] = useState<string | null>(null);
  const [draft, setDraft] = useState<CalendarDraft>(() => emptyDraft(undefined, 9, "", timezone));
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorBusyAction, setEditorBusyAction] = useState<"" | "save" | "cancel" | "restore">("");
  const [editorError, setEditorError] = useState("");
  const [busyCount, setBusyCount] = useState(0);
  const [message, setMessage] = useState("Ready");
  const refreshSequence = useRef(0);
  const eventDetailRequests = useRef(new LatestRequestGuard());
  const calendarColors = useMemo(() => calendarColorMap(calendars), [calendars]);
  const eventRows = useMemo(() => filterCalendarEvents(events, query, statusFilter, availabilityFilter).sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start)), [events, query, statusFilter, availabilityFilter]);

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(path, { ...options, headers: { ...calendarAuthHeaders(token), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data as T;
  }

  async function refreshCalendar(calendarId?: string) {
    eventDetailRequests.current.cancel();
    const requestId = ++refreshSequence.current;
    if (!token || !operational) return;
    try {
      const rows = await api<CalendarRecord[]>("/api/calendar/calendars");
      const requestedCalendarId = calendarId ?? activeCalendarId;
      const nextCalendarId = requestedCalendarId === null
        ? rows[0]?.id || ""
        : requestedCalendarId === "" || rows.some((row) => row.id === requestedCalendarId)
          ? requestedCalendarId
          : rows[0]?.id || "";
      let nextEvents: CalendarEventRecord[] = [];
      let nextBusyCount = 0;
      const range = rangeForView(view, cursorDate);
      if (rows.length) {
        const params = new URLSearchParams({ from_at: range.from.toISOString(), to_at: range.to.toISOString(), include_canceled: "true" });
        if (nextCalendarId) params.set("calendar_id", nextCalendarId);
        const [eventResult, freebusy] = await Promise.all([
          api<CalendarEventRecord[]>(`/api/calendar/events?${params.toString()}`),
          api<{ busy: unknown[] }>(`/api/calendar/freebusy?${params.toString()}`),
        ]);
        nextEvents = eventResult;
        nextBusyCount = freebusy.busy.length;
      }
      if (requestId !== refreshSequence.current) return;
      setCalendars(rows);
      setActiveCalendarId(nextCalendarId);
      setEvents(nextEvents);
      setBusyCount(nextBusyCount);
      setMessage(`Loaded ${rows.length} calendars and ${durationDays(range.from, range.to)} visible days.`);
    } catch (error) {
      if (requestId !== refreshSequence.current) return;
      setMessage(calendarErrorMessage(error));
    }
  }

  async function createDefaultCalendar() {
    try {
      const row = await api<CalendarRecord>("/api/calendar/calendars", {
        method: "POST",
        body: JSON.stringify({ name: calendars.length ? `Calendar ${calendars.length + 1}` : "Default Calendar", timezone, visibility_scope: "organization" })
      });
      await refreshCalendar(row.id);
      setMessage(`Created ${row.name}.`);
    } catch (error) {
      setMessage(calendarErrorMessage(error));
    }
  }

  function showEditorError(text: string) {
    setEditorError(text);
    setMessage(text);
  }

  async function saveEvent() {
    if (!draft.calendarId) return showEditorError("Choose a calendar before saving.");
    if (!draft.title.trim()) return showEditorError("Enter a title before saving.");
    const timing = resolveCalendarDraftTiming(draft, selectedEvent);
    if (!timing.ok) return showEditorError(timing.error);
    const reminderMinutes = draft.reminderMinutes === "" ? null : Number(draft.reminderMinutes);
    if (reminderMinutes !== null && (!Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > 43200)) return showEditorError("Reminder minutes must be a whole number between 0 and 43200.");
    if (draft.id && !selectedEventEtag) return showEditorError("Reload this event before saving so UOK can protect newer changes.");
    const payload = eventPayload(draft, timezone, selectedEvent);
    const updatePayload = { ...payload, calendar_id: undefined };
    setEditorError("");
    setEditorBusyAction("save");
    try {
      const saved = draft.id
        ? await api<CalendarEventRecord>(`/api/calendar/events/${draft.id}`, {
          method: "PATCH",
          headers: { "If-Match": selectedEventEtag || "" },
          body: JSON.stringify(updatePayload),
        })
        : await api<CalendarEventRecord>("/api/calendar/events", { method: "POST", body: JSON.stringify(payload) });
      if (!saved.id) throw new Error("Calendar event save did not return an event identifier.");
      setEditorOpen(false);
      setSelectedEvent(undefined);
      setSelectedEventEtag(null);
      await refreshCalendar();
      setMessage(draft.id ? "Event updated." : "Event created.");
    } catch (error) {
      showEditorError(calendarErrorMessage(error));
    } finally {
      setEditorBusyAction("");
    }
  }

  async function cancelEvent() {
    if (!draft.id) return;
    if (!selectedEventEtag) return showEditorError("Reload this event before canceling so UOK can protect newer changes.");
    setEditorError("");
    setEditorBusyAction("cancel");
    try {
      await api(`/api/calendar/events/${draft.id}/cancel`, {
        method: "POST",
        headers: { "If-Match": selectedEventEtag },
      });
      setEditorOpen(false);
      setSelectedEventEtag(null);
      await refreshCalendar();
      setMessage("Event canceled.");
    } catch (error) {
      showEditorError(calendarErrorMessage(error));
    } finally {
      setEditorBusyAction("");
    }
  }
  async function restoreEvent() {
    if (!draft.id) return;
    if (!selectedEventEtag) return showEditorError("Reload this event before restoring so UOK can protect newer changes.");
    setEditorError("");
    setEditorBusyAction("restore");
    try {
      await api(`/api/calendar/events/${draft.id}/restore`, {
        method: "POST",
        headers: { "If-Match": selectedEventEtag },
      });
      setEditorOpen(false);
      setSelectedEventEtag(null);
      await refreshCalendar();
      setMessage("Event restored.");
    } catch (error) {
      showEditorError(calendarErrorMessage(error));
    } finally {
      setEditorBusyAction("");
    }
  }
  async function selectEvent(event: CalendarEventRecord) {
    const request = eventDetailRequests.current.begin();
    try {
      const detail = await loadCalendarEventDetail(event, token, request.signal);
      if (!request.isCurrent()) return;
      setSelectedEvent(detail.event);
      setSelectedEventEtag(detail.etag);
      setDraft(draftFromEvent(detail.event));
      setEditorError("");
      setEditorOpen(true);
    } catch (error) {
      if (!request.isCurrent()) return;
      setMessage(calendarErrorMessage(error));
    } finally {
      request.release();
    }
  }
  function newEvent(date = cursorDate, hour = 9) {
    eventDetailRequests.current.cancel();
    const calendarId = activeCalendarId || calendars[0]?.id || "";
    const draftTimezone = calendars.find((calendar) => calendar.id === calendarId)?.timezone || timezone;
    setSelectedEvent(undefined);
    setSelectedEventEtag(null);
    setDraft(emptyDraft(date, hour, calendarId, draftTimezone));
    setEditorError("");
    setEditorOpen(true);
  }

  async function exportIcs() {
    const range = rangeForView(view, cursorDate);
    const params = new URLSearchParams({ from_at: range.from.toISOString(), to_at: range.to.toISOString() });
    if (activeCalendarId) params.set("calendar_id", activeCalendarId);
    try {
      await downloadCalendarIcs(token, params);
    } catch (error) {
      setMessage(calendarErrorMessage(error));
    }
  }

  useEffect(() => {
    void refreshCalendar();
    return () => eventDetailRequests.current.cancel();
  }, [token, operational, view, cursorDate]);

  if (!token) return <EmptyState text="Sign in to open Calendar." />;
  if (!operational) return <CalendarModuleState module={module} busyAction={busyAction} onInstall={onInstall} />;

  return (
    <section aria-label="Calendar" className="calendar-workspace">
      <CalendarToolbar
        view={view}
        cursorDate={cursorDate}
        query={query}
        statusFilter={statusFilter}
        availabilityFilter={availabilityFilter}
        onViewChange={setView}
        onQueryChange={setQuery}
        onStatusFilterChange={setStatusFilter}
        onAvailabilityFilterChange={setAvailabilityFilter}
        onClearFilters={() => {
          setQuery("");
          setStatusFilter("active");
          setAvailabilityFilter("all");
        }}
        onToday={() => setCursorDate(startOfDay(new Date()))}
        onMove={(direction) => setCursorDate(view === "month" || view === "agenda" ? addMonths(cursorDate, direction) : addDays(cursorDate, direction * (view === "week" ? 7 : 1)))}
        onCreate={() => newEvent()}
        onRefresh={() => void refreshCalendar()}
        onExport={() => void exportIcs()}
      />
      <div className="calendar-layout">
        <CalendarMiniMonth
          cursorDate={cursorDate}
          calendars={calendars}
          activeCalendarId={activeCalendarId || ""}
          onDateChange={setCursorDate}
          onCalendarChange={(id) => void refreshCalendar(id)}
          onCreateCalendar={createDefaultCalendar}
        />
        <main className="calendar-main" aria-label="Calendar events">
          <div className="calendar-summary">
            <span>{eventRows.length} events</span>
            <span>{busyCount} busy blocks</span>
            <span role="status" aria-live="polite" aria-atomic="true">{message}</span>
          </div>
          {view === "month" && <CalendarMonthView cursorDate={cursorDate} events={eventRows} calendarColors={calendarColors} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "week" && <CalendarTimeGrid view="week" cursorDate={cursorDate} events={eventRows} calendarColors={calendarColors} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "day" && <CalendarTimeGrid view="day" cursorDate={cursorDate} events={eventRows} calendarColors={calendarColors} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "agenda" && <CalendarAgendaView events={eventRows} calendarColors={calendarColors} selectedEventId={selectedEvent?.id} onSelectEvent={(event) => void selectEvent(event)} />}
        </main>
      </div>
      <CalendarEventEditor
        open={editorOpen}
        draft={draft}
        calendars={calendars}
        selectedEvent={selectedEvent}
        busyAction={editorBusyAction}
        error={editorError}
        onDraftChange={setDraft}
        onSave={saveEvent}
        onCancel={cancelEvent}
        onRestore={restoreEvent}
        onClose={() => {
          eventDetailRequests.current.cancel();
          setEditorOpen(false);
          setEditorError("");
        }}
      />
    </section>
  );
}
