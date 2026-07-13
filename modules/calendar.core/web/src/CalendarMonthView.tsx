import type { CalendarEventRecord } from "./calendarTypes";
import { CalendarEventStatus } from "./CalendarEventStatus";
import { calendarEventStyle } from "./calendarPresentation";
import { dayKey, eventTimeLabel, eventsForDay, monthCells } from "./calendarDates";

export function CalendarMonthView({
  cursorDate,
  events,
  calendarColors,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  cursorDate: Date;
  events: CalendarEventRecord[];
  calendarColors: Record<string, string>;
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
                  className={`calendar-event-chip ${event.status}${event.id === selectedEventId ? " selected" : ""}`}
                  style={calendarEventStyle(event.calendar_id, calendarColors)}
                  onClick={() => onSelectEvent(event)}
                >
                  <span>{eventTimeLabel(event)}</span>
                  <strong>{event.title}</strong>
                  <CalendarEventStatus status={event.status} />
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
