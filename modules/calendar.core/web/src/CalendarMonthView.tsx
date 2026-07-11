import type { CalendarEventRecord } from "./calendarTypes";
import { dayKey, eventTimeLabel, eventsForDay, monthCells } from "./calendarDates";

export function CalendarMonthView({
  cursorDate,
  events,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  cursorDate: Date;
  events: CalendarEventRecord[];
  selectedEventId?: string;
  onSelectDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  const cells = monthCells(cursorDate);
  const todayKey = dayKey(new Date());
  return (
    <div className="calendar-month-grid" role="grid" aria-label="Month calendar">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <div key={label} className="calendar-weekday">{label}</div>)}
      {cells.map((date) => {
        const rows = eventsForDay(events, date);
        const outside = date.getMonth() !== cursorDate.getMonth();
        return (
          <div key={dayKey(date)} className={outside ? "calendar-day outside" : "calendar-day"} role="gridcell">
            <button type="button" className={dayKey(date) === todayKey ? "calendar-day-number today" : "calendar-day-number"} onClick={() => onSelectDay(date)}>
              {date.getDate()}
            </button>
            <div className="calendar-day-events">
              {rows.slice(0, 4).map((event) => (
                <button
                  key={`${event.id}-${event.occurrence_start}`}
                  type="button"
                  className={event.id === selectedEventId ? "calendar-event-chip selected" : `calendar-event-chip ${event.status}`}
                  onClick={() => onSelectEvent(event)}
                >
                  <span>{eventTimeLabel(event)}</span>
                  <strong>{event.title}</strong>
                </button>
              ))}
              {rows.length > 4 ? <span className="calendar-more">+{rows.length - 4} more</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
