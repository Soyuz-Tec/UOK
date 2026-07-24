import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { ExpandableControlPanel } from "@uok/shared/forms";
import { useUokLocalization } from "@uok/shared/localization";
import { IconButton } from "@uok/shared/primitives";
import { CalendarDateGrid } from "./CalendarDateGrid";
import { dateInMonth, dayKey, startOfDay, startOfMonth, viewTitle } from "./calendarDates";
import type { CalendarView } from "./calendarTypes";
import { CalendarYearPicker } from "./CalendarYearPicker";
import { CalendarYearTrigger } from "./CalendarYearTrigger";
import { YEAR_BROWSE_RADIUS } from "./calendarYears";

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
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() => startOfMonth(cursorDate));
  const [focusedDate, setFocusedDate] = useState(() => startOfDay(cursorDate));
  const gridRef = useRef<HTMLDivElement>(null);
  const yearTriggerRef = useRef<HTMLButtonElement>(null);
  const yearPickerId = `calendar-year-picker-${useId().replaceAll(":", "")}`;
  const formatLocale = locale === "ar" ? "ar-u-nu-arab" : locale;
  const rangeTitle = viewTitle(view, cursorDate, formatLocale);
  const monthTitle = displayMonth.toLocaleDateString(formatLocale, { month: "long", year: "numeric" });
  const monthName = displayMonth.toLocaleDateString(formatLocale, { month: "long" });
  const displayYear = displayMonth.getFullYear();
  const minYear = cursorDate.getFullYear() - YEAR_BROWSE_RADIUS;
  const maxYear = cursorDate.getFullYear() + YEAR_BROWSE_RADIUS;
  const canShowDate = (date: Date) => date.getFullYear() >= minYear && date.getFullYear() <= maxYear;
  const canMoveToPreviousMonth = displayYear > minYear || displayMonth.getMonth() > 0;
  const canMoveToNextMonth = displayYear < maxYear || displayMonth.getMonth() < 11;

  useEffect(() => {
    if (open) return;
    setDisplayMonth(startOfMonth(cursorDate));
    setFocusedDate(startOfDay(cursorDate));
  }, [cursorDate, open]);

  const moveFocus = (date: Date) => {
    const next = startOfDay(date);
    if (!canShowDate(next)) return;
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
    if (!canShowDate(nextMonth)) return;
    const nextFocused = dateInMonth(nextMonth, focusedDate.getDate());
    setDisplayMonth(nextMonth);
    setFocusedDate(nextFocused);
  };

  const changeDisplayedYear = (year: number) => {
    const nextMonth = new Date(displayMonth);
    nextMonth.setDate(1);
    nextMonth.setFullYear(year);
    const nextFocused = dateInMonth(nextMonth, focusedDate.getDate());
    setDisplayMonth(nextMonth);
    setFocusedDate(nextFocused);
    return nextFocused;
  };

  const closeYearPicker = () => {
    setYearPickerOpen(false);
    queueMicrotask(() => yearTriggerRef.current?.focus());
  };

  const selectYear = (year: number) => {
    const nextFocused = changeDisplayedYear(year);
    setYearPickerOpen(false);
    queueMicrotask(() => gridRef.current?.querySelector<HTMLElement>(`[data-calendar-date="${dayKey(nextFocused)}"]`)?.focus());
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
        setYearPickerOpen(false);
        if (nextOpen) {
          setDisplayMonth(startOfMonth(cursorDate));
          setFocusedDate(startOfDay(cursorDate));
        }
        setOpen(nextOpen);
      }}
    >
      {({ close }) => open ? (
        <section
          className="calendar-date-navigator-content"
          aria-label={monthTitle}
          onKeyDown={(event) => {
            if (!yearPickerOpen || event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            closeYearPicker();
          }}
        >
          <header className="calendar-date-navigator-header">
            {yearPickerOpen ? <span aria-hidden="true" /> : (
              <IconButton
                icon={ChevronLeft}
                label={t("calendar.navigator.previousMonth", "Previous month")}
                onClick={() => changeDisplayedMonth(-1)}
                disabled={!canMoveToPreviousMonth}
              />
            )}
            <div className="calendar-date-navigator-period">
              <h3>{monthName}</h3>
              <CalendarYearTrigger
                ref={yearTriggerRef}
                controls={yearPickerId}
                open={yearPickerOpen}
                year={displayYear}
                onClick={() => yearPickerOpen ? closeYearPicker() : setYearPickerOpen(true)}
              />
            </div>
            {yearPickerOpen ? <span aria-hidden="true" /> : (
              <IconButton
                icon={ChevronRight}
                label={t("calendar.navigator.nextMonth", "Next month")}
                onClick={() => changeDisplayedMonth(1)}
                disabled={!canMoveToNextMonth}
              />
            )}
          </header>
          {yearPickerOpen ? (
            <CalendarYearPicker
              id={yearPickerId}
              year={displayYear}
              minYear={minYear}
              maxYear={maxYear}
              onSelect={selectYear}
              onCancel={closeYearPicker}
            />
          ) : (
            <CalendarDateGrid
              ref={gridRef}
              direction={direction}
              displayMonth={displayMonth}
              focusedDate={focusedDate}
              selectedDate={cursorDate}
              locale={formatLocale}
              minYear={minYear}
              maxYear={maxYear}
              onFocusDate={setFocusedDate}
              onMoveFocus={moveFocus}
              onSelect={(date) => {
                close();
                queueMicrotask(() => onDateChange(date));
              }}
            />
          )}
        </section>
      ) : null}
    </ExpandableControlPanel>
  );
}
