import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import { CalendarEventStatus } from "./CalendarEventStatus";
import { addDays, dayKey, eventTimeLabel, startOfDay, startOfWeek } from "./calendarDates";
import { calendarEventStyle } from "./calendarPresentation";
import { layoutCalendarDay, MINUTES_PER_DAY } from "./calendarTimeLayout";
import type { CalendarEventRecord, CalendarView } from "./calendarTypes";

const hours = Array.from({ length: 24 }, (_, hour) => hour);
const INITIAL_HOUR = 7;
const HOUR_HEIGHT = 64;

type TimeGridStyle = CSSProperties & { "--calendar-day-count": number };

export function CalendarTimeGrid({
  view,
  cursorDate,
  events,
  calendarColors,
  selectedEventId,
  onSelectDay,
  onSelectEvent,
}: {
  view: Extract<CalendarView, "week" | "day">;
  cursorDate: Date;
  events: CalendarEventRecord[];
  calendarColors: Record<string, string>;
  selectedEventId?: string;
  onSelectDay: (date: Date, hour?: number) => void;
  onSelectEvent: (event: CalendarEventRecord) => void;
}) {
  const { t } = useUokLocalization();
  const gridRef = useRef<HTMLDivElement>(null);
  const previousViewRef = useRef<typeof view | null>(null);
  const [activeSlot, setActiveSlot] = useState({ dayIndex: 0, hour: INITIAL_HOUR });
  const days = view === "day" ? [startOfDay(cursorDate)] : Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(cursorDate), index));
  const dayLayouts = days.map((day) => ({ day, layout: layoutCalendarDay(events, day) }));
  const gridStyle: TimeGridStyle = { "--calendar-day-count": days.length };

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = INITIAL_HOUR * HOUR_HEIGHT;
      if (view === "day" && previousViewRef.current !== "day") gridRef.current.focus();
    }
    previousViewRef.current = view;
    setActiveSlot({ dayIndex: 0, hour: INITIAL_HOUR });
  }, [view, cursorDate]);

  function moveSlot(event: KeyboardEvent<HTMLButtonElement>, dayIndex: number, hour: number) {
    let nextDay = dayIndex;
    let nextHour = hour;
    if (event.key === "ArrowUp") nextHour = Math.max(0, hour - 1);
    else if (event.key === "ArrowDown") nextHour = Math.min(23, hour + 1);
    else if (event.key === "ArrowLeft") nextDay = Math.max(0, dayIndex - 1);
    else if (event.key === "ArrowRight") nextDay = Math.min(days.length - 1, dayIndex + 1);
    else if (event.key === "Home") nextHour = 0;
    else if (event.key === "End") nextHour = 23;
    else return;
    event.preventDefault();
    setActiveSlot({ dayIndex: nextDay, hour: nextHour });
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLButtonElement>(`[data-calendar-day="${nextDay}"][data-calendar-hour="${nextHour}"]`)
        ?.focus();
    });
  }

  return (
    <div ref={gridRef} className={view === "day" ? "calendar-time-grid day" : "calendar-time-grid"} aria-label={`${view} calendar`} tabIndex={view === "day" ? -1 : undefined} style={gridStyle}>
      <div className="calendar-time-grid-canvas">
        <div className="calendar-time-header-row">
          <div className="calendar-time-corner" />
          {days.map((day) => (
            <div key={dayKey(day)} className="calendar-time-heading">
              <strong>{day.toLocaleDateString(undefined, { weekday: "short" })}</strong>
              <span>{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </div>
          ))}
        </div>
        <div className="calendar-all-day-row">
          <div className="calendar-all-day-label">{t("calendar.event.allDay", "All day")}</div>
          {dayLayouts.map(({ day, layout }) => (
            <div key={dayKey(day)} className="calendar-all-day-cell">
              {layout.allDay.map((event) => (
                <button
                  type="button"
                  key={`${event.id}-${event.occurrence_start}`}
                  className={`calendar-time-event ${event.status}${event.id === selectedEventId ? " selected" : ""}`}
                  style={calendarEventStyle(event.calendar_id, calendarColors)}
                  onClick={() => onSelectEvent(event)}
                >
                  <strong>{event.title}</strong>
                  <CalendarEventStatus status={event.status} />
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="calendar-time-body">
          <div className="calendar-time-hours" aria-hidden="true">
            {hours.map((hour) => <div key={hour} className="calendar-hour-label">{hourLabel(hour)}</div>)}
          </div>
          {dayLayouts.map(({ day, layout }, dayIndex) => (
            <div key={dayKey(day)} className="calendar-time-day-column">
              {hours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  className="calendar-hour-target"
                  data-calendar-day={dayIndex}
                  data-calendar-hour={hour}
                  tabIndex={activeSlot.dayIndex === dayIndex && activeSlot.hour === hour ? 0 : -1}
                  onFocus={() => setActiveSlot({ dayIndex, hour })}
                  onKeyDown={(event) => moveSlot(event, dayIndex, hour)}
                  onClick={() => onSelectDay(day, hour)}
                  aria-label={`${t("calendar.event.createOn", "Create event on")} ${day.toLocaleDateString()} ${t("calendar.event.at", "at")} ${hourLabel(hour)}`}
                />
              ))}
              <div className="calendar-time-events-layer">
                {layout.timed.map((segment) => (
                  <button
                    type="button"
                    key={segment.key}
                    className={`calendar-time-event ${segment.event.status}${segment.event.id === selectedEventId ? " selected" : ""}`}
                    style={segmentStyle(segment.startMinute, segment.endMinute, segment.lane, segment.laneCount, calendarEventStyle(segment.event.calendar_id, calendarColors))}
                    onClick={() => onSelectEvent(segment.event)}
                  >
                    <strong>{segment.event.title}</strong>
                    <small>{eventTimeLabel(segment.event)}</small>
                    <CalendarEventStatus status={segment.event.status} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function segmentStyle(startMinute: number, endMinute: number, lane: number, laneCount: number, colorStyle: CSSProperties): CSSProperties {
  const top = (startMinute / MINUTES_PER_DAY) * 100;
  const height = ((endMinute - startMinute) / MINUTES_PER_DAY) * 100;
  const laneWidth = 100 / laneCount;
  return {
    ...colorStyle,
    top: `${top}%`,
    height: `max(22px, ${height}%)`,
    insetInlineStart: `calc(${lane * laneWidth}% + 2px)`,
    inlineSize: `calc(${laneWidth}% - 4px)`,
  };
}

function hourLabel(hour: number) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: "numeric" });
}
