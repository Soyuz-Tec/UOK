import { forwardRef, useMemo, type KeyboardEvent } from "react";

import { addDays, dayKey, monthCells, shiftDateMonth, startOfDay } from "./calendarDates";

export const CalendarDateGrid = forwardRef<HTMLDivElement, {
  direction: "ltr" | "rtl";
  displayMonth: Date;
  focusedDate: Date;
  selectedDate: Date;
  locale: string;
  minYear: number;
  maxYear: number;
  onFocusDate: (date: Date) => void;
  onMoveFocus: (date: Date) => void;
  onSelect: (date: Date) => void;
}>(function CalendarDateGrid({
  direction,
  displayMonth,
  focusedDate,
  selectedDate,
  locale,
  minYear,
  maxYear,
  onFocusDate,
  onMoveFocus,
  onSelect,
}, ref) {
  const cells = monthCells(displayMonth);
  const selectedKey = dayKey(selectedDate);
  const focusedKey = dayKey(focusedDate);
  const todayKey = dayKey(new Date());
  const monthTitle = displayMonth.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const sunday = new Date(2021, 7, 1 + index, 12);
    return sunday.toLocaleDateString(locale, { weekday: "narrow" });
  }), [locale]);

  const onDateKeyDown = (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
    const horizontalStep = direction === "rtl" ? -1 : 1;
    const next = event.key === "ArrowLeft"
      ? addDays(date, -horizontalStep)
      : event.key === "ArrowRight"
        ? addDays(date, horizontalStep)
        : event.key === "ArrowUp"
          ? addDays(date, -7)
          : event.key === "ArrowDown"
            ? addDays(date, 7)
            : event.key === "Home"
              ? addDays(date, -date.getDay())
              : event.key === "End"
                ? addDays(date, 6 - date.getDay())
                : event.key === "PageUp"
                  ? shiftDateMonth(date, -1)
                  : event.key === "PageDown"
                    ? shiftDateMonth(date, 1)
                    : null;
    if (!next) return;
    event.preventDefault();
    onMoveFocus(next);
  };

  return (
    <div ref={ref} className="calendar-date-grid" role="grid" aria-label={monthTitle}>
      <div className="calendar-date-weekdays" role="row">
        {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} role="columnheader">{label}</span>)}
      </div>
      {Array.from({ length: 6 }, (_, weekIndex) => (
        <div key={weekIndex} className="calendar-date-week" role="row">
          {cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date) => {
            const key = dayKey(date);
            const outside = date.getMonth() !== displayMonth.getMonth();
            const unavailable = date.getFullYear() < minYear || date.getFullYear() > maxYear;
            const fullLabel = date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
            return (
              <button
                key={key}
                type="button"
                role="gridcell"
                className={[outside ? "outside" : "", unavailable ? "unavailable" : "", key === selectedKey ? "selected" : "", key === todayKey ? "today" : ""].filter(Boolean).join(" ")}
                aria-current={key === todayKey ? "date" : undefined}
                aria-label={fullLabel}
                aria-selected={key === selectedKey}
                data-calendar-date={key}
                data-calendar-date-focus={key === focusedKey ? "true" : undefined}
                tabIndex={key === focusedKey ? 0 : -1}
                disabled={unavailable}
                onFocus={() => onFocusDate(startOfDay(date))}
                onKeyDown={(event) => onDateKeyDown(event, date)}
                onClick={() => onSelect(startOfDay(date))}
              >
                {date.toLocaleDateString(locale, { day: "numeric" })}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});
