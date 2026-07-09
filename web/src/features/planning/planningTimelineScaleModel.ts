import type { ViewDensity } from "./planningTimelineModel";

export const timelineScales = ["minute", "hour", "day", "week", "sprint", "stage", "month", "quarter", "year"] as const;
export type TimelineScale = typeof timelineScales[number];

export type TimelineUnit = {
  key: string;
  label: string;
  group: string;
  date: Date;
  weekend: boolean;
  holiday: boolean;
};

export function unitDays(scale: TimelineScale) {
  if (scale === "minute") return 1 / 48;
  if (scale === "hour") return 0.25;
  if (scale === "sprint") return 14;
  if (scale === "stage") return 30;
  if (scale === "year") return 365;
  if (scale === "quarter") return 91;
  if (scale === "month") return 30;
  if (scale === "week") return 7;
  return 1;
}

export function unitLabel(date: Date, scale: TimelineScale) {
  if (scale === "minute") return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (scale === "hour") return String(date.getHours()).padStart(2, "0");
  if (scale === "sprint") return `S${blockNumber(date, 14)}`;
  if (scale === "stage") return `Stage ${blockNumber(date, 30)}`;
  if (scale === "year") return String(date.getFullYear());
  if (scale === "quarter") return `Q${Math.floor(date.getMonth() / 3) + 1}`;
  if (scale === "month") return date.toLocaleString("en-US", { month: "short" });
  if (scale === "week") return `W${weekNumber(date)}`;
  return String(date.getDate());
}

export function groupLabel(date: Date, scale: TimelineScale) {
  if (scale === "minute" || scale === "hour") return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (scale === "sprint" || scale === "stage" || scale === "month" || scale === "quarter" || scale === "year") return String(date.getFullYear());
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function startOfUnit(date: Date, scale: TimelineScale) {
  const next = new Date(date);
  if (scale === "week") next.setDate(next.getDate() - next.getDay());
  if (scale === "sprint") return startOfBlock(next, 14);
  if (scale === "stage") return startOfBlock(next, 30);
  if (scale === "month") next.setDate(1);
  if (scale === "quarter") next.setMonth(Math.floor(next.getMonth() / 3) * 3, 1);
  if (scale === "year") next.setMonth(0, 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfUnit(date: Date, scale: TimelineScale) {
  const next = new Date(date);
  if (scale === "week") next.setDate(next.getDate() + (6 - next.getDay()));
  if (scale === "sprint") return addDays(startOfBlock(next, 14), 13);
  if (scale === "stage") return addDays(startOfBlock(next, 30), 29);
  if (scale === "month") next.setMonth(next.getMonth() + 1, 0);
  if (scale === "quarter") next.setMonth(Math.floor(next.getMonth() / 3) * 3 + 3, 0);
  if (scale === "year") next.setMonth(11, 31);
  next.setHours(scale === "minute" ? 23 : scale === "hour" ? 18 : 0, scale === "minute" ? 30 : 0, 0, 0);
  return next;
}

export function addUnit(date: Date, scale: TimelineScale) {
  if (scale === "minute") return addMinutes(date, 30);
  if (scale === "hour") return addHours(date, 6);
  if (scale === "year") return addYears(date, 1);
  if (scale === "quarter") return addMonths(date, 3);
  if (scale === "month") return addMonths(date, 1);
  return addDays(date, unitDays(scale));
}

export function dragDeltaDays(deltaCells: number, scale: TimelineScale) {
  if (scale === "minute") return Math.trunc(deltaCells / 48);
  if (scale === "hour") return Math.trunc(deltaCells / 4);
  return deltaCells * unitDays(scale);
}

export function unitMs(scale: TimelineScale) {
  return unitDays(scale) * 86_400_000;
}

export function unitKey(date: Date, scale: TimelineScale) {
  if (scale !== "hour" && scale !== "minute") return isoDatePart(date);
  return `${isoDatePart(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function cellWidth(scale: TimelineScale, viewDensity: ViewDensity) {
  if (scale === "minute") return viewDensity === "compact" ? 10 : 12;
  if (scale === "hour") return viewDensity === "compact" ? 28 : 34;
  if (scale === "sprint") return 110;
  if (scale === "stage") return 132;
  if (scale === "year") return 180;
  if (scale === "quarter") return 150;
  if (scale === "month") return 120;
  if (scale === "week") return 92;
  return viewDensity === "compact" ? 44 : 52;
}

function addMinutes(date: Date, minutes: number) {
  const next = new Date(date);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
}

function addHours(date: Date, hours: number) {
  const next = new Date(date);
  next.setHours(next.getHours() + hours);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function addYears(date: Date, years: number) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function weekNumber(value: Date) {
  const first = new Date(value.getFullYear(), 0, 1);
  return Math.ceil((((value.getTime() - first.getTime()) / 86_400_000) + first.getDay() + 1) / 7);
}

function startOfBlock(date: Date, blockDays: number) {
  const start = new Date(date.getFullYear(), 0, 1);
  start.setDate(start.getDate() + Math.floor((dayOfYear(date) - 1) / blockDays) * blockDays);
  start.setHours(0, 0, 0, 0);
  return start;
}

function blockNumber(date: Date, blockDays: number) {
  return Math.floor((dayOfYear(date) - 1) / blockDays) + 1;
}

function dayOfYear(date: Date) {
  const year = date.getFullYear();
  return Math.floor((Date.UTC(year, date.getMonth(), date.getDate()) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
}

function isoDatePart(date: Date) {
  return date.toISOString().slice(0, 10);
}
