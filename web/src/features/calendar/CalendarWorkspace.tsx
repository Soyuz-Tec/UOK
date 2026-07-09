import { CalendarPlus, Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ModuleStatus } from "../../shared/types";
import { CommandButton, EmptyState, Pane, StatusPill } from "../../shared/ui";
import { CALENDAR_MODULE_ID } from "./calendarModule";

type CalendarRecord = { id: string; name: string; status: string; timezone: string };
type CalendarEventRecord = { id: string; title: string; occurrence_start: string; occurrence_end: string; status: string; location?: string | null };

type Props = {
  token: string;
  moduleRows: ModuleStatus[];
  busyAction: string;
  onInstall: () => void;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function localDateTime(offsetHours = 0) {
  const value = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
  value.setMinutes(0, 0, 0);
  return value.toISOString().slice(0, 16);
}

function monthWindow() {
  const now = new Date();
  return {
    from_at: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    to_at: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()
  };
}

export function CalendarWorkspace({ token, moduleRows, busyAction, onInstall }: Props) {
  const module = moduleRows.find((row) => row.name === CALENDAR_MODULE_ID);
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [calendars, setCalendars] = useState<CalendarRecord[]>([]);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState("");
  const [title, setTitle] = useState("New meeting");
  const [startsAt, setStartsAt] = useState(localDateTime(1));
  const [endsAt, setEndsAt] = useState(localDateTime(2));
  const [message, setMessage] = useState<unknown>("Ready");
  const activeCalendarId = selectedCalendarId || calendars[0]?.id || "";

  const eventRows = useMemo(() => events.slice().sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start)), [events]);

  async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(path, { ...options, headers: { ...authHeaders(token), ...(options.headers || {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw data;
    return data as T;
  }

  async function refreshCalendar() {
    if (!token || !operational) return;
    try {
      const rows = await api<CalendarRecord[]>("/api/calendar/calendars");
      setCalendars(rows);
      const calendarId = selectedCalendarId || rows[0]?.id || "";
      if (calendarId) {
        const params = new URLSearchParams({ ...monthWindow(), calendar_id: calendarId });
        setEvents(await api<CalendarEventRecord[]>(`/api/calendar/events?${params.toString()}`));
      } else {
        setEvents([]);
      }
      setMessage({ status: "loaded", calendars: rows.length });
    } catch (error) {
      setMessage(error);
    }
  }

  async function createDefaultCalendar() {
    try {
      const row = await api<CalendarRecord>("/api/calendar/calendars", {
        method: "POST",
        body: JSON.stringify({ name: "Default Calendar", timezone, visibility_scope: "organization" })
      });
      setSelectedCalendarId(row.id);
      await refreshCalendar();
    } catch (error) {
      setMessage(error);
    }
  }

  async function createEvent() {
    if (!activeCalendarId || !title.trim()) return;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end <= start) {
      setMessage({ error: "Enter a valid start and end time; end must be after start." });
      return;
    }
    try {
      await api("/api/calendar/events", {
        method: "POST",
        body: JSON.stringify({
          calendar_id: activeCalendarId,
          title,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          timezone
        })
      });
      await refreshCalendar();
      setMessage({ status: "event_created", title });
    } catch (error) {
      setMessage(error);
    }
  }

  useEffect(() => {
    void refreshCalendar();
  }, [token, operational, selectedCalendarId]);

  if (!token) return <EmptyState text="Sign in to open Calendar." />;

  if (!operational) {
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

  return (
    <section aria-label="Calendar" className="contacts-workspace">
      <div className="contacts-controls">
        <label className="field compact">
          <span>Calendar</span>
          <select value={activeCalendarId} onChange={(event) => setSelectedCalendarId(event.target.value)}>
            {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
          </select>
        </label>
        <CommandButton icon={CalendarPlus} onClick={createDefaultCalendar}>New calendar</CommandButton>
        <CommandButton icon={RefreshCw} onClick={refreshCalendar}>Refresh</CommandButton>
      </div>

      <div className="contacts-utility-grid">
        <Pane title="Create Event" description="Event form">
          <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field"><span>Starts</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></label>
          <label className="field"><span>Ends</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label>
          <CommandButton icon={CalendarPlus} onClick={createEvent} disabled={!activeCalendarId}>Create event</CommandButton>
        </Pane>

        <Pane title="This Month" description="Calendar events">
          {eventRows.length ? (
            <div className="review-items">
              {eventRows.map((event) => (
                <div key={`${event.id}-${event.occurrence_start}`} className="review-chip">
                  <strong>{event.title}</strong>
                  <span>{new Date(event.occurrence_start).toLocaleString()} - {new Date(event.occurrence_end).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          ) : <EmptyState text="No calendar events found for this month." />}
        </Pane>
      </div>

      <Pane title="Calendar Status" description="Last calendar operation" wide>
        <pre className="json-block">{typeof message === "string" ? message : JSON.stringify(message, null, 2)}</pre>
      </Pane>
    </section>
  );
}
