import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { EmptyState, StatusPill } from "../../shared/data-display";
import { Pane } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
import type { ModuleStatus } from "../../shared/types";
import { CalendarAgendaView } from "./CalendarAgendaView";
import { CalendarEventEditor } from "./CalendarEventEditor";
import { CalendarMiniMonth } from "./CalendarMiniMonth";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarTimeGrid } from "./CalendarTimeGrid";
import { CalendarToolbar } from "./CalendarToolbar";
import { CALENDAR_MODULE_ID } from "./calendarModule";
import { addDays, addMonths, durationDays, eventStart, rangeForView, startOfDay } from "./calendarDates";
import { draftFromEvent, emptyDraft, eventPayload } from "./calendarDrafts";
import { filterCalendarEvents } from "./calendarFilters";
import type { CalendarDraft, CalendarEventRecord, CalendarRecord, CalendarView } from "./calendarTypes";

type Props = {
  token: string;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onInstall: () => void;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export function CalendarWorkspace({ token, moduleRows, busyAction, onInstall }: Props) {
  const module = moduleRows.find((row) => row.name === CALENDAR_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [calendars, setCalendars] = useState<CalendarRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [activeCalendarId, setActiveCalendarId] = useState("");
  const [view, setView] = useState<CalendarView>("month");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [cursorDate, setCursorDate] = useState(startOfDay(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventRecord | undefined>();
  const [draft, setDraft] = useState<CalendarDraft>(emptyDraft());
  const [editorOpen, setEditorOpen] = useState(false);
  const [busyCount, setBusyCount] = useState(0);
  const [message, setMessage] = useState("Ready");
  const eventRows = useMemo(() => filterCalendarEvents(events, query, statusFilter, availabilityFilter).sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start)), [events, query, statusFilter, availabilityFilter]);

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(path, { ...options, headers: { ...authHeaders(token), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data as T;
  }

  async function refreshCalendar(calendarId = activeCalendarId) {
    if (!token || !operational) return;
    try {
      const rows = await api<CalendarRecord[]>("/api/calendar/calendars");
      setCalendars(rows);
      const nextCalendarId = calendarId || rows[0]?.id || "";
      setActiveCalendarId(nextCalendarId);
      if (nextCalendarId) {
        const range = rangeForView(view, cursorDate);
        const params = new URLSearchParams({ from_at: range.from.toISOString(), to_at: range.to.toISOString(), calendar_id: nextCalendarId, include_canceled: "true" });
        setEvents(await api<CalendarEventRecord[]>(`/api/calendar/events?${params.toString()}`));
        const freebusy = await api<{ busy: unknown[] }>(`/api/calendar/freebusy?${params.toString()}`);
        setBusyCount(freebusy.busy.length);
      } else {
        setEvents([]);
        setBusyCount(0);
      }
      setMessage(`Loaded ${rows.length} calendars and ${durationDays(rangeForView(view, cursorDate).from, rangeForView(view, cursorDate).to)} visible days.`);
    } catch (error) {
      setMessage(errorMessage(error));
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
      setMessage(errorMessage(error));
    }
  }

  async function saveEvent() {
    if (!activeCalendarId || !draft.title.trim()) return setMessage("Enter a title before saving.");
    const startsAt = new Date(draft.startsAt);
    const endsAt = new Date(draft.endsAt);
    if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || endsAt <= startsAt) return setMessage("End time must be after start time.");
    const payload = eventPayload(draft, activeCalendarId, timezone);
    try {
      const saved = draft.id
        ? await api<CalendarEventRecord>(`/api/calendar/events/${draft.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await api<CalendarEventRecord>("/api/calendar/events", { method: "POST", body: JSON.stringify(payload) });
      const reminderMinutes = draft.reminderMinutes === "" ? null : Number(draft.reminderMinutes);
      const reminderExists = selectedEvent?.reminders?.some((reminder) => reminder.trigger_minutes_before === reminderMinutes);
      if (reminderMinutes != null && saved.id && !reminderExists) {
        await api(`/api/calendar/events/${saved.id}/reminders`, { method: "POST", body: JSON.stringify({ reminder_type: "in_app", trigger_minutes_before: reminderMinutes }) });
      }
      setEditorOpen(false);
      setSelectedEvent(undefined);
      await refreshCalendar();
      setMessage(draft.id ? "Event updated." : "Event created.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function cancelEvent() {
    if (!draft.id) return;
    await api(`/api/calendar/events/${draft.id}/cancel`, { method: "POST" });
    setEditorOpen(false);
    await refreshCalendar();
    setMessage("Event canceled.");
  }

  async function restoreEvent() {
    if (!draft.id) return;
    await api(`/api/calendar/events/${draft.id}/restore`, { method: "POST" });
    setEditorOpen(false);
    await refreshCalendar();
    setMessage("Event restored.");
  }

  async function selectEvent(event: CalendarEventRecord) {
    const detail = await api<CalendarEventRecord>(`/api/calendar/events/${event.id}`);
    const merged = { ...event, ...detail };
    setSelectedEvent(merged);
    setDraft(draftFromEvent(merged));
    setEditorOpen(true);
  }

  function newEvent(date = cursorDate, hour = 9) {
    setSelectedEvent(undefined);
    setDraft(emptyDraft(date, hour));
    setEditorOpen(true);
  }

  async function exportIcs() {
    const range = rangeForView(view, cursorDate);
    const params = new URLSearchParams({ from_at: range.from.toISOString(), to_at: range.to.toISOString(), calendar_id: activeCalendarId });
    const res = await fetch(`/api/calendar/ics/export?${params.toString()}`, { headers: authHeaders(token) });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "uok-calendar.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    void refreshCalendar();
  }, [token, operational, view, cursorDate]);

  if (!token) return <EmptyState text="Sign in to open Calendar." />;
  if (!operational) return <CalendarModuleState module={module} busyAction={busyAction} onInstall={onInstall} />;

  return (
    <section aria-label="Calendar" className="calendar-workspace">
      <CalendarToolbar
        calendars={calendars}
        activeCalendarId={activeCalendarId}
        view={view}
        cursorDate={cursorDate}
        query={query}
        statusFilter={statusFilter}
        availabilityFilter={availabilityFilter}
        onCalendarChange={(id) => void refreshCalendar(id)}
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
      <div className={editorOpen ? "calendar-layout" : "calendar-layout editor-closed"}>
        <CalendarMiniMonth
          cursorDate={cursorDate}
          calendars={calendars}
          activeCalendarId={activeCalendarId}
          onDateChange={setCursorDate}
          onCalendarChange={(id) => void refreshCalendar(id)}
          onCreateCalendar={createDefaultCalendar}
        />
        <main className="calendar-main" aria-label="Calendar events">
          <div className="calendar-summary">
            <span>{eventRows.length} events</span>
            <span>{busyCount} busy blocks</span>
            <span>{message}</span>
          </div>
          {view === "month" && <CalendarMonthView cursorDate={cursorDate} events={eventRows} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "week" && <CalendarTimeGrid view="week" cursorDate={cursorDate} events={eventRows} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "day" && <CalendarTimeGrid view="day" cursorDate={cursorDate} events={eventRows} selectedEventId={selectedEvent?.id} onSelectDay={newEvent} onSelectEvent={(event) => void selectEvent(event)} />}
          {view === "agenda" && <CalendarAgendaView events={eventRows} selectedEventId={selectedEvent?.id} onSelectEvent={(event) => void selectEvent(event)} />}
        </main>
        {editorOpen ? <CalendarEventEditor draft={draft} selectedEvent={selectedEvent} onDraftChange={setDraft} onSave={saveEvent} onCancel={cancelEvent} onRestore={restoreEvent} onClose={() => setEditorOpen(false)} /> : null}
      </div>
    </section>
  );
}

function CalendarModuleState({ module, busyAction, onInstall }: { module?: ModuleStatus; busyAction: string; onInstall: () => void }) {
  return (
    <section aria-label="Calendar">
      <Pane title="Calendar" description="Module state" wide>
        <div className="module-row">
          <div className="module-main">
            <div className="module-title-line">
              <h2 className="module-name">calendar.core</h2>
              <StatusPill label={module?.status || "available"} tone="info" />
            </div>
            <p className="module-meta">capability_module - {module?.version || "not loaded"}</p>
          </div>
          <div className="module-actions">
            <CommandButton icon={Download} onClick={onInstall} loading={busyAction === "calendar.core:install"}>Install</CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}

function errorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "detail" in error) return JSON.stringify((error as { detail: unknown }).detail);
  return "Calendar operation failed.";
}
