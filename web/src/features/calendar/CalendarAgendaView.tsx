import type { CalendarEventRecord } from "./calendarTypes";
import { dayKey, eventStart, eventTimeLabel } from "./calendarDates";

export function CalendarAgendaView({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: CalendarEventRecord[];
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
              className={event.id === selectedEventId ? "calendar-agenda-event selected" : "calendar-agenda-event"}
              onClick={() => onSelectEvent(event)}
            >
              <span>{eventTimeLabel(event)}</span>
              <strong>{event.title}</strong>
              <em>{event.location || event.transparency}</em>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
