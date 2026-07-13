import type { CalendarEventRecord } from "./calendarTypes";
import { CalendarEventStatus } from "./CalendarEventStatus";
import { calendarEventStyle } from "./calendarPresentation";
import { dayKey, eventStart, eventTimeLabel } from "./calendarDates";

export function CalendarAgendaView({
  events,
  calendarColors,
  selectedEventId,
  onSelectEvent,
}: {
  events: CalendarEventRecord[];
  calendarColors: Record<string, string>;
  selectedEventId?: string;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  const grouped = events.reduce<Record<string, CalendarEventRecord[]>>((acc, event) => {
    const key = dayKey(eventStart(event));
    acc[key] = [...(acc[key] || []), event];
    return acc;
  }, {});

  if (!events.length) return <div className="calendar-empty">No events in this range.</div>;

  return (
    <div className="calendar-agenda" aria-label="Calendar agenda">
      {Object.entries(grouped).map(([key, rows]) => (
        <section key={key} className="calendar-agenda-day">
          <h3>{eventStart(rows[0]).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</h3>
          {rows.map((event) => (
            <button
              type="button"
              key={`${event.id}-${event.occurrence_start}`}
              className={`calendar-agenda-event ${event.status}${event.id === selectedEventId ? " selected" : ""}`}
              style={calendarEventStyle(event.calendar_id, calendarColors)}
              onClick={() => onSelectEvent(event)}
            >
              <span>{eventTimeLabel(event)}</span>
              <strong>{event.title}</strong>
              <em>{event.location || event.transparency}</em>
              <CalendarEventStatus status={event.status} />
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
