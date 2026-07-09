import { timelineScales, type TimelineScale } from "./planningGanttModel";

export const timelineScaleOptions = timelineScales.map((value) => ({ value, label: value }));
const zoomScaleOrder: TimelineScale[] = ["year", "quarter", "month", "week", "day", "hour"];

export function scaleToZoomValue(scale: TimelineScale) {
  return Math.max(0, zoomScaleOrder.indexOf(scale));
}

export function zoomValueToScale(value: string) {
  return zoomScaleOrder[Number(value)] || "day";
}

export function maxZoomValue() {
  return zoomScaleOrder.length - 1;
}
