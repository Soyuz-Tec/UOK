import type { CSSProperties } from "react";

import type { CalendarRecord } from "./calendarTypes";

const CALENDAR_HEX_COLOR = /^#[0-9a-f]{6}$/i;

type CalendarStyle = CSSProperties & {
  "--calendar-color"?: string;
  "--calendar-event-color"?: string;
};

export function resolvedCalendarColor(color?: string | null) {
  const candidate = color?.trim();
  return candidate && CALENDAR_HEX_COLOR.test(candidate) ? candidate.toUpperCase() : "var(--uok-accent)";
}

export function calendarColorMap(calendars: CalendarRecord[]) {
  return Object.fromEntries(calendars.map((calendar) => [calendar.id, resolvedCalendarColor(calendar.color)]));
}

export function calendarSwatchStyle(color?: string | null): CalendarStyle {
  return { "--calendar-color": resolvedCalendarColor(color) };
}

export function calendarEventStyle(calendarId: string, colors: Record<string, string>): CalendarStyle {
  return { "--calendar-event-color": colors[calendarId] || "var(--uok-accent)" };
}
