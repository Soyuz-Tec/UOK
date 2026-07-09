import { timelineScales, type TimelineScale } from "./planningGanttModel";

export const timelineScaleOptions = timelineScales.map((value) => ({ value, label: value }));
const zoomScaleOrder: TimelineScale[] = ["year", "quarter", "month", "stage", "sprint", "week", "day", "hour", "minute"];

export function scaleToZoomValue(scale: TimelineScale) {
  return Math.max(0, zoomScaleOrder.indexOf(scale));
}

export function zoomValueToScale(value: string) {
  return zoomScaleOrder[Number(value)] || "day";
}

export function maxZoomValue() {
  return zoomScaleOrder.length - 1;
}

export function adjacentTimelineScale(scale: TimelineScale, direction: "in" | "out") {
  const current = scaleToZoomValue(scale);
  const delta = direction === "in" ? 1 : -1;
  return zoomScaleOrder[Math.max(0, Math.min(maxZoomValue(), current + delta))] || scale;
}
