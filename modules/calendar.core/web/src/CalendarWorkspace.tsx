import { useMemo, useRef, useState } from "react";

import { EmptyState } from "@uok/shared/data-display";
import type { ModuleStatus } from "@uok/shared/types";
import { CalendarActiveView } from "./CalendarActiveView";
import { CalendarEventEditor } from "./CalendarEventEditor";
import { CalendarToolbar } from "./CalendarToolbar";
import { CalendarModuleState, calendarErrorMessage } from "./CalendarWorkspaceSupport";
import { CalendarWorkspaceStatus } from "./CalendarWorkspaceStatus";
import { downloadCalendarIcs, loadCalendarEventDetail } from "./calendarClient";
import { resolveCalendarDraftTiming } from "./calendarDraftTiming";
import { CALENDAR_MODULE_ID } from "./calendarModule";
import { addDays, addMonths, rangeForView, startOfDay } from "./calendarDates";
import { draftFromEvent, emptyDraft, eventPayload } from "./calendarDrafts";
import { filterCalendarEvents } from "./calendarFilters";
import { calendarColorMap } from "./calendarPresentation";
import type { CalendarDraft, CalendarEventRecord, CalendarView } from "./calendarTypes";
import { LatestRequestGuard } from "./latestRequestGuard";
import { useCalendarCatalog } from "./useCalendarCatalog";

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
  const eventDetailRequests = useRef(new LatestRequestGuard());
  const catalog = useCalendarCatalog({
    token, operational, timezone, view, cursorDate,
    onRefreshStart: () => eventDetailRequests.current.cancel(),
    onDeleteSuccess: (calendar) => {
      if (selectedEvent?.calendar_id !== calendar.id && draft.calendarId !== calendar.id) return;
      setEditorOpen(false);
      setSelectedEvent(undefined);
      setSelectedEventEtag(null);
      setEditorError("");
    },
  });
  const {
    activeCalendarId, api, busyCount, calendarBusyAction, calendars, capabilities, deletedCalendars,
    createCalendar, deleteCalendar, events, refreshCalendar, restoreCalendar, setStatusMessage,
    setWorkspaceFailure, setWorkspaceStatus, statusMessage, workspaceError,
  } = catalog;
  const calendarColors = useMemo(() => calendarColorMap(calendars), [calendars]);
  const eventRows = useMemo(() => filterCalendarEvents(events, query, statusFilter, availabilityFilter).sort((a, b) => a.occurrence_start.localeCompare(b.occurrence_start)), [events, query, statusFilter, availabilityFilter]);

  function showEditorError(text: string) {
    setEditorError(text);
    setStatusMessage(text);
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
      setWorkspaceStatus(draft.id ? "Event updated." : "Event created.");
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
      setWorkspaceStatus("Event canceled.");
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
      setWorkspaceStatus("Event restored.");
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
      setWorkspaceFailure(error);
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
      setWorkspaceFailure(error);
    }
  }

  if (!token) return <EmptyState text="Sign in to open Calendar." />;
  if (!operational) return <CalendarModuleState module={module} busyAction={busyAction} onInstall={onInstall} />;

  return (
    <section aria-label="Calendar" className="calendar-workspace">
      <CalendarToolbar
        view={view}
        cursorDate={cursorDate}
        calendars={calendars}
        deletedCalendars={deletedCalendars}
        activeCalendarId={activeCalendarId || ""}
        query={query}
        statusFilter={statusFilter}
        availabilityFilter={availabilityFilter}
        onViewChange={setView}
        onDateChange={setCursorDate}
        onCalendarChange={(id) => void refreshCalendar(id)}
        onCreateCalendar={createCalendar}
        onDeleteCalendar={deleteCalendar}
        onRestoreCalendar={restoreCalendar}
        canCreateCalendar={capabilities.create}
        canDeleteCalendar={capabilities.delete}
        canRestoreCalendar={capabilities.restore}
        calendarBusyAction={calendarBusyAction}
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
        canCreateEvent={calendars.length > 0}
        onRefresh={() => void refreshCalendar()}
        onExport={() => void exportIcs()}
      />
      <main className="calendar-main" aria-label="Calendar events">
        <CalendarWorkspaceStatus eventCount={eventRows.length} busyCount={busyCount} message={statusMessage} error={workspaceError} />
        <CalendarActiveView view={view} cursorDate={cursorDate} events={eventRows} calendarColors={calendarColors}
          selectedEventId={selectedEvent?.id} onSelectDay={newEvent}
          onOpenDay={(date) => { setCursorDate(startOfDay(date)); setView("day"); }}
          onSelectEvent={(event) => void selectEvent(event)} />
      </main>
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
