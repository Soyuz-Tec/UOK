import { useUokLocalization } from "@uok/shared/localization";
import type { PlanningProject } from "./types";
import { projectBoundaryMarkers } from "./planningBoundaryMarkers";
import { dateValue, xForDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningTimelineMarker } from "./planningTimelineMarkers";

type TimelineMarkerLayer = "all" | "lines" | "annotations";

export function ProjectBoundaryMarkers({ project, chartStart, scale, cellWidth, headerHeight = 54, height, layer = "all", offsetY = 0 }: {
  project: PlanningProject;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  headerHeight?: number;
  height: number;
  layer?: TimelineMarkerLayer;
  offsetY?: number;
}) {
  const { t } = useUokLocalization();
  const markers = projectBoundaryMarkers(project, chartStart, scale, cellWidth, {
    start: t("planning.gantt.projectStart", "Project start"),
    end: t("planning.gantt.compatibilityHorizon", "Compatibility horizon"),
    target: t("planning.gantt.targetFinish", "Target finish"),
    calculated: t("planning.gantt.calculatedFinish", "Calculated finish"),
  });
  const annotations = layer !== "lines";
  const lines = layer !== "annotations";
  return (
    <g className={`planning-owned-boundary-markers planning-owned-boundary-marker-${layer}`} transform={annotations && offsetY ? `translate(0 ${offsetY})` : undefined} aria-hidden={annotations ? undefined : true}>
      {markers.map((marker) => (
        <g key={marker.keys.join("-")} className={`${annotations ? "planning-owned-boundary-marker" : "planning-owned-boundary-marker-line"} ${marker.keys.join(" ")}`} role={annotations ? "img" : undefined} aria-label={annotations ? marker.accessibilityLabel : undefined}>
          {annotations ? <title>{marker.accessibilityLabel}</title> : null}
          {lines ? <line x1={marker.x} y1="0" x2={marker.x} y2={height} /> : null}
          {annotations ? <text x={marker.x + 6} y={headerHeight - 4}>{marker.labels.join(" / ")}</text> : null}
        </g>
      ))}
    </g>
  );
}

export function TaskTimelineMarkers({ markers, chartStart, scale, cellWidth, height, timelineWidth, layer = "all", offsetY = 0 }: {
  markers: PlanningTimelineMarker[];
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  height: number;
  timelineWidth: number;
  layer?: TimelineMarkerLayer;
  offsetY?: number;
}) {
  if (markers.length === 0) return null;
  const groups = markerDisplayGroups(markers, chartStart, scale, cellWidth);
  const annotations = layer !== "lines";
  const lines = layer !== "annotations";
  return (
    <g className={`planning-owned-task-markers planning-owned-task-marker-${layer}`} aria-label={annotations ? "Task deadline markers" : undefined} aria-hidden={annotations ? undefined : true} transform={annotations && offsetY ? `translate(0 ${offsetY})` : undefined}>
      {groups.map((group) => {
        const surfaceX = Math.min(Math.max(4, group.anchorX - 17), timelineWidth - 38);
        const accessibilityLabel = group.items.map(({ marker }) => marker.label).join("; ");
        return (
          <g key={group.items.map(({ marker }) => marker.id).join("-")} className={annotations ? "planning-owned-task-marker" : "planning-owned-task-marker-line"} role={annotations ? "img" : undefined} aria-label={annotations ? accessibilityLabel : undefined}>
            {annotations ? <title>{group.items.map(({ marker }) => `${marker.label} on ${marker.date}`).join("; ")}</title> : null}
            {lines ? group.items.map(({ marker, x }) => <line key={marker.id} className={marker.kind} x1={x} y1="0" x2={x} y2={height} />) : null}
            {annotations ? <rect className="planning-owned-task-marker-surface" x={surfaceX} y="20" width="34" height="12" rx="3" /> : null}
            {annotations ? <text x={surfaceX + 17} y="29" textAnchor="middle">{group.items.length === 1 ? group.items[0].marker.code : `+${group.items.length}`}</text> : null}
          </g>
        );
      })}
    </g>
  );
}

function markerDisplayGroups(markers: PlanningTimelineMarker[], chartStart: Date, scale: TimelineScale, cellWidth: number) {
  const positioned = markers.map((marker) => ({ marker, x: xForDate(dateValue(marker.date), chartStart, scale, cellWidth) + cellWidth }));
  return positioned.reduce<Array<{ anchorX: number; items: typeof positioned }>>((groups, item) => {
    const current = groups[groups.length - 1];
    const previous = current?.items[current.items.length - 1];
    if (!current || !previous || item.x - previous.x >= 38) groups.push({ anchorX: item.x + 5, items: [item] });
    else {
      current.items.push(item);
      current.anchorX = (current.items[0].x + item.x) / 2 + 5;
    }
    return groups;
  }, []);
}
