import type { CalendarEventRecord, CalendarView } from "./calendarTypes";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function startOfWeek(date: Date) {
  return addDays(startOfDay(date), -date.getDay());
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthCells(date: Date) {
  const first = startOfWeek(startOfMonth(date));
  return Array.from({ length: 42 }, (_, index) => addDays(first, index));
}

export function rangeForView(view: CalendarView, cursor: Date) {
  if (view === "day") {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1) };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7) };
  }
  const cells = monthCells(cursor);
  return { from: cells[0], to: addDays(cells[cells.length - 1], 1) };
}

export function viewTitle(view: CalendarView, cursor: Date, locale?: string) {
  if (view === "day") {
    return cursor.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    return `${start.toLocaleDateString(locale, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`;
  }
  return cursor.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function eventStart(event: CalendarEventRecord) {
  return new Date(event.occurrence_start || event.starts_at || "");
}

export function eventEnd(event: CalendarEventRecord) {
  return new Date(event.occurrence_end || event.ends_at || "");
}

export function eventsForDay(events: CalendarEventRecord[], day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return events.filter((event) => eventStart(event) < end && eventEnd(event) > start);
}

export function eventTimeLabel(event: CalendarEventRecord) {
  if (event.all_day) return "All day";
  const start = eventStart(event);
  const end = eventEnd(event);
  return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export function durationDays(from: Date, to: Date) {
  return Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS));
}
