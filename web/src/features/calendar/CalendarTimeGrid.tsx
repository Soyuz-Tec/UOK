import type { CalendarEventRecord, CalendarView } from "./calendarTypes";
import { addDays, dayKey, eventEnd, eventStart, eventTimeLabel, eventsForDay, startOfDay, startOfWeek } from "./calendarDates";

const hours = Array.from({ length: 12 }, (_, index) => index + 7);

export function CalendarTimeGrid({
  view,
  cursorDate,
  events,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  view: Extract<CalendarView, "week" | "day">;
  cursorDate: Date;
  events: CalendarEventRecord[];
  selectedEventId?: string;
  onSelectDay: (date: Date, hour?: number) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  const days = view === "day" ? [startOfDay(cursorDate)] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursorDate), index));
  return (
    <div className={view === "day" ? "calendar-time-grid day" : "calendar-time-grid"} aria-label={`${view} calendar`}>
      <div className="calendar-time-corner" />
      {days.map((day) => (
        <div key={dayKey(day)} className="calendar-time-heading">
          <strong>{day.toLocaleDateString(undefined, { weekday: "short" })}</strong>
          <span>{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
        </div>
      ))}
      {hours.map((hour) => (
        <CalendarHourRow
          key={hour}
          hour={hour}
          days={days}
          events={events}
          selectedEventId={selectedEventId}
          onSelectDay={onSelectDay}
          onSelectEvent={onSelectEvent}
        />
      ))}
    </div>
  );
}

function CalendarHourRow({
  hour,
  days,
  events,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  hour: number;
  days: Date[];
  events: CalendarEventRecord[];
  selectedEventId?: string;
  onSelectDay: (date: Date, hour?: number) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  return (
    <>
      <div className="calendar-hour-label">{hourLabel(hour)}</div>
      {days.map((day) => {
        const rows = eventsForDay(events, day).filter((event) => eventEnd(event).getHours() >= hour && eventStart(event).getHours() <= hour);
        return (
          <div key={`${dayKey(day)}-${hour}`} className="calendar-hour-cell">
            <button type="button" className="calendar-hour-target" onClick={() => onSelectDay(day, hour)} aria-label={`Create event at ${hourLabel(hour)}`} />
            {rows.map((event) => (
              <button
                type="button"
                key={`${event.id}-${event.occurrence_start}`}
                className={event.id === selectedEventId ? "calendar-time-event selected" : "calendar-time-event"}
                onClick={() => onSelectEvent(event)}
              >
                <strong>{event.title}</strong>
                <small>{eventTimeLabel(event)}</small>
              </button>
            ))}
          </div>
        );
      })}
    </>
  );
}

function hourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric" });
}
