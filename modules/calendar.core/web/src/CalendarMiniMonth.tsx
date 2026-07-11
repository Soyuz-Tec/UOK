import { CalendarPlus } from "lucide-react";

import { CommandButton } from "@uok/shared/primitives";
import type { CalendarRecord } from "./calendarTypes";
import { dayKey, monthCells } from "./calendarDates";

export function CalendarMiniMonth({
  cursorDate,
  calendars,
  activeCalendarId,
  onDateChange,
  onCalendarChange,
  onCreateCalendar,
}: {
  cursorDate: Date;
  calendars: CalendarRecord[];
  activeCalendarId: string;
  onDateChange: (date: Date) => void;
  onCalendarChange: (calendarId: string) => void;
  onCreateCalendar: () => void;
}) {
  const cells = monthCells(cursorDate);
  const selectedKey = dayKey(cursorDate);
  return (
    <aside className="calendar-side-panel" aria-label="Calendar side panel">
      <section>
        <h3>{cursorDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h3>
        <div className="calendar-mini-grid">
          {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
          {cells.map((date) => (
            <button key={dayKey(date)} type="button" className={dayKey(date) === selectedKey ? "selected" : ""} onClick={() => onDateChange(date)}>
              {date.getDate()}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3>Calendars</h3>
        <div className="calendar-list">
          {calendars.map((calendar) => (
            <button
              key={calendar.id}
              type="button"
              className={calendar.id === activeCalendarId ? "selected" : ""}
              onClick={() => onCalendarChange(calendar.id)}
            >
              <span className="calendar-color-dot" aria-hidden="true" />
              <strong>{calendar.name}</strong>
              <small>{calendar.timezone}</small>
            </button>
          ))}
        </div>
        <CommandButton icon={CalendarPlus} onClick={onCreateCalendar}>New calendar</CommandButton>
      </section>
    </aside>
  );
}
