import type { PlanningTask } from "./types";
import type { TimelineScale } from "./planningGanttModel";
import { planningBaselineLane } from "./planningBaselineLaneModel";

export function PlanningBaselineLane({
  cellWidth,
  chartStart,
  scale,
  task,
  y,
}: {
  cellWidth: number;
  chartStart: Date;
  scale: TimelineScale;
  task: PlanningTask;
  y: number;
}) {
  const lane = planningBaselineLane(task, chartStart, scale, cellWidth);
  if (!lane) return null;
  return (
    <g className={`planning-owned-baseline-lane ${lane.status}`} aria-label={lane.label}>
      <title>{lane.label}</title>
      <rect className="baseline-bar" x={lane.x} y={y} width={lane.width} height="5" rx="2.5" />
      {lane.varianceWidth > 0 ? <rect className="baseline-variance" x={lane.varianceX} y={y + 6} width={lane.varianceWidth} height="2" rx="1" /> : null}
      <rect className="baseline-code" x={lane.x + lane.width + 5} y={y - 12} width={44} height="14" rx="4" />
      <text x={lane.x + lane.width + 27} y={y - 2} textAnchor="middle">{lane.code}</text>
    </g>
  );
}
