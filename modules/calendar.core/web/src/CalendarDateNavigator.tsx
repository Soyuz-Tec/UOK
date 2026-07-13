import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { ExpandableControlPanel } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { IconButton } from "@uok/shared/primitives";
import { addDays, dayKey, monthCells, startOfDay, startOfMonth, viewTitle } from "./calendarDates";
import type { CalendarView } from "./calendarTypes";
import { CalendarYearSelect } from "./CalendarYearSelect";

export function CalendarDateNavigator({
  view,
  cursorDate,
  onDateChange,
}: {
  view: CalendarView;
  cursorDate: Date;
  onDateChange: (date: Date) => void;
}) {
  const { direction, locale, t } = useUokLocalization();
  const [open, setOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(cursorDate));
  const [focusedDate, setFocusedDate] = useState(() => startOfDay(cursorDate));
  const gridRef = useRef<HTMLDivElement>(null);
  const formatLocale = locale === "ar" ? "ar-u-nu-arab" : locale;
  const rangeTitle = viewTitle(view, cursorDate, formatLocale);
  const monthTitle = displayMonth.toLocaleDateString(formatLocale, { month: "long", year: "numeric" });
  const monthName = displayMonth.toLocaleDateString(formatLocale, { month: "long" });
  const displayYear = displayMonth.getFullYear();
  const selectedKey = dayKey(cursorDate);
  const focusedKey = dayKey(focusedDate);
  const todayKey = dayKey(new Date());
  const cells = monthCells(displayMonth);
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const sunday = new Date(2021, 7, 1 + index, 12);
    return sunday.toLocaleDateString(formatLocale, { weekday: "narrow" });
  }), [formatLocale]);

  useEffect(() => {
    if (open) return;
    setDisplayMonth(startOfMonth(cursorDate));
    setFocusedDate(startOfDay(cursorDate));
  }, [cursorDate, open]);

  const moveFocus = (date: Date) => {
    const next = startOfDay(date);
    setFocusedDate(next);
    if (next.getMonth() !== displayMonth.getMonth() || next.getFullYear() !== displayMonth.getFullYear()) {
      setDisplayMonth(startOfMonth(next));
    }
    queueMicrotask(() => gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${dayKey(next)}"]`)?.focus());
  };

  const changeDisplayedMonth = (offset: -1 | 1) => {
    const nextMonth = new Date(displayMonth);
    nextMonth.setDate(1);
    nextMonth.setMonth(displayMonth.getMonth() + offset);
    const nextFocused = dateInMonth(nextMonth, focusedDate.getDate());
    setDisplayMonth(nextMonth);
    setFocusedDate(nextFocused);
  };

  const changeDisplayedYear = (year: number) => {
    const nextMonth = new Date(displayMonth);
    nextMonth.setDate(1);
    nextMonth.setFullYear(year);
    setDisplayMonth(nextMonth);
    setFocusedDate(dateInMonth(nextMonth, focusedDate.getDate()));
  };

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
    moveFocus(next);
  };

  return (
    <ExpandableControlPanel
      className="calendar-date-navigator"
      panelClassName="calendar-date-navigator-panel"
      label={t("calendar.navigator.label", "Date navigator")}
      triggerLabel={`${t("calendar.navigator.open", "Choose date")}: ${rangeTitle}`}
      triggerSummary={<span title={rangeTitle}>{rangeTitle}</span>}
      initialFocusSelector="[data-calendar-date-focus='true']"
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDisplayMonth(startOfMonth(cursorDate));
          setFocusedDate(startOfDay(cursorDate));
        }
        setOpen(nextOpen);
      }}
    >
      {({ close }) => open ? (
        <section className="calendar-date-navigator-content" aria-label={monthTitle}>
          <header className="calendar-date-navigator-header">
            <IconButton
              icon={ChevronLeft}
              label={t("calendar.navigator.previousMonth", "Previous month")}
              onClick={() => changeDisplayedMonth(-1)}
            />
            <div className="calendar-date-navigator-period">
              <h3>{monthName}</h3>
              <CalendarYearSelect
                year={displayYear}
                locale={formatLocale}
                label={t("calendar.navigator.year", "Year")}
                onChange={changeDisplayedYear}
              />
            </div>
            <IconButton
              icon={ChevronRight}
              label={t("calendar.navigator.nextMonth", "Next month")}
              onClick={() => changeDisplayedMonth(1)}
            />
          </header>
          <div ref={gridRef} className="calendar-date-grid" role="grid" aria-label={monthTitle}>
            <div className="calendar-date-weekdays" role="row">
              {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} role="columnheader">{label}</span>)}
            </div>
            {Array.from({ length: 6 }, (_, weekIndex) => (
              <div key={weekIndex} className="calendar-date-week" role="row">
                {cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((date) => {
                  const key = dayKey(date);
                  const outside = date.getMonth() !== displayMonth.getMonth();
                  const fullLabel = date.toLocaleDateString(formatLocale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      className={[outside ? "outside" : "", key === selectedKey ? "selected" : "", key === todayKey ? "today" : ""].filter(Boolean).join(" ")}
                      aria-current={key === todayKey ? "date" : undefined}
                      aria-label={fullLabel}
                      aria-selected={key === selectedKey}
                      data-calendar-date={key}
                      data-calendar-date-focus={key === focusedKey ? "true" : undefined}
                      tabIndex={key === focusedKey ? 0 : -1}
                      onFocus={() => setFocusedDate(startOfDay(date))}
                      onKeyDown={(event) => onDateKeyDown(event, date)}
                      onClick={() => {
                        close();
                        queueMicrotask(() => onDateChange(startOfDay(date)));
                      }}
                    >
                      {date.toLocaleDateString(formatLocale, { day: "numeric" })}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </ExpandableControlPanel>
  );
}

function dateInMonth(month: Date, requestedDay: number) {
  const monthEnd = new Date(month);
  monthEnd.setDate(1);
  monthEnd.setFullYear(month.getFullYear(), month.getMonth() + 1, 0);
  const result = new Date(month);
  result.setDate(1);
  result.setFullYear(month.getFullYear(), month.getMonth(), Math.min(requestedDay, monthEnd.getDate()));
  result.setHours(0, 0, 0, 0);
  return result;
}

function shiftDateMonth(date: Date, offset: -1 | 1) {
  const targetMonth = new Date(date);
  targetMonth.setDate(1);
  targetMonth.setMonth(date.getMonth() + offset);
  return dateInMonth(targetMonth, date.getDate());
}
