import { dateValue, isValidPlanningDate, xForDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningProject } from "./types";

export type PlanningBoundaryMarker = {
  keys: string[];
  labels: string[];
  details: string[];
  x: number;
  accessibilityLabel: string;
};

export function projectBoundaryMarkers(
  project: PlanningProject,
  chartStart: Date,
  scale: TimelineScale,
  cellWidth: number,
  labels: Record<"start" | "end" | "target" | "calculated", string>,
) {
  const fallbackDate = [project.end, project.start, project.target_finish, project.calculated_finish].find(isValidPlanningDate) ?? "1970-01-01";
  const startDate = isValidPlanningDate(project.start) ? project.start : fallbackDate;
  const endDate = isValidPlanningDate(project.end) ? project.end : startDate;
  const targetDate = isValidPlanningDate(project.target_finish) ? project.target_finish : endDate;
  const calculatedDate = isValidPlanningDate(project.calculated_finish) ? project.calculated_finish : endDate;
  const candidates = [
    { key: "start" as const, label: labels.start, date: startDate, x: xForDate(dateValue(startDate), chartStart, scale, cellWidth) },
    { key: "end" as const, label: labels.end, date: endDate, x: xForDate(dateValue(endDate), chartStart, scale, cellWidth) + cellWidth },
    { key: "target" as const, label: labels.target, date: targetDate, x: xForDate(dateValue(targetDate), chartStart, scale, cellWidth) + cellWidth },
    { key: "calculated" as const, label: labels.calculated, date: calculatedDate, x: xForDate(dateValue(calculatedDate), chartStart, scale, cellWidth) + cellWidth },
  ];
  const markers: PlanningBoundaryMarker[] = [];
  for (const candidate of candidates) {
    if (!Number.isFinite(candidate.x)) continue;
    const existing = markers.find((marker) => marker.x === candidate.x);
    if (existing) {
      existing.keys.push(candidate.key);
      existing.labels.push(candidate.label);
      existing.details.push(`${candidate.label}: ${candidate.date}`);
      existing.accessibilityLabel = existing.details.join("; ");
    } else {
      const detail = `${candidate.label}: ${candidate.date}`;
      markers.push({ keys: [candidate.key], labels: [candidate.label], details: [detail], x: candidate.x, accessibilityLabel: detail });
    }
  }
  return markers;
}
