import { useUokLocalization } from "@uok/shared/localization";
import type { CalendarEventRecord } from "./calendarTypes";
import { CalendarEventStatus } from "./CalendarEventStatus";
import { calendarEventStyle } from "./calendarPresentation";
import { dayKey, eventStartTimeLabel, eventTimeLabel, eventsForDay, monthCells } from "./calendarDates";

const MAX_VISIBLE_EVENTS_PER_DAY = 3;

export function CalendarMonthView({
  cursorDate,
  events,
  calendarColors,
  selectedEventId,
  onSelectDay,
  onOpenDay,
  onSelectEvent,
}: {
  cursorDate: Date;
  events: CalendarEventRecord[];
  calendarColors: Record<string, string>;
  selectedEventId?: string;
  onSelectDay: (date: Date) => void;
  onOpenDay: (date: Date) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  const { formatDate, formatNumber, t } = useUokLocalization();
  const cells = monthCells(cursorDate);
  const todayKey = dayKey(new Date());
  return (
    <div className="calendar-month-grid" role="grid" aria-label="Month calendar">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => <div key={label} className="calendar-weekday">{label}</div>)}
      {cells.map((date) => {
        const rows = eventsForDay(events, date);
        const hiddenCount = Math.max(0, rows.length - MAX_VISIBLE_EVENTS_PER_DAY);
        const outside = date.getMonth() !== cursorDate.getMonth();
        return (
          <div key={dayKey(date)} className={outside ? "calendar-day outside" : "calendar-day"} role="gridcell">
            <button type="button" className={dayKey(date) === todayKey ? "calendar-day-number today" : "calendar-day-number"} onClick={() => onSelectDay(date)}>
              {date.getDate()}
            </button>
            <div className="calendar-day-events">
              {rows.slice(0, MAX_VISIBLE_EVENTS_PER_DAY).map((event) => (
                <button
                  key={`${event.id}-${event.occurrence_start}`}
                  type="button"
                  className={`calendar-event-chip ${event.status}${event.id === selectedEventId ? " selected" : ""}`}
                  style={calendarEventStyle(event.calendar_id, calendarColors)}
                  onClick={() => onSelectEvent(event)}
                >
                  <span className="visually-hidden">{eventTimeLabel(event)}</span>
                  <span className="calendar-event-start" aria-hidden="true">{eventStartTimeLabel(event)}</span>
                  <strong>{event.title}</strong>
                  <CalendarEventStatus status={event.status} />
                </button>
              ))}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  className="calendar-more"
                  aria-label={t("calendar.month.openMore", "Open {count} more events on {date}")
                    .replace("{count}", formatNumber(hiddenCount))
                    .replace("{date}", formatDate(date))}
                  onClick={() => onOpenDay(date)}
                >
                  {t("calendar.month.more", "+{count} more").replace("{count}", formatNumber(hiddenCount))}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
