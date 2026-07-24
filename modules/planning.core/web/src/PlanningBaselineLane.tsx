import type { PlanningTask } from "./types";
import type { TimelineScale } from "./planningGanttModel";
import { planningBaselineLane } from "./planningBaselineLaneModel";

export function PlanningBaselineLane({
  cellWidth,
  chartStart,
  scale,
  showCode,
  task,
  timelineWidth,
  y,
}: {
  cellWidth: number;
  chartStart: Date;
  scale: TimelineScale;
  showCode: boolean;
  task: PlanningTask;
  timelineWidth: number;
  y: number;
}) {
  const lane = planningBaselineLane(task, chartStart, scale, cellWidth);
  if (!lane) return null;
  const codeX = Math.min(Math.max(4, lane.x + lane.width + 5), timelineWidth - 48);
  return (
    <g className={`planning-owned-baseline-lane ${lane.status}`} aria-label={lane.label}>
      <title>{lane.label}</title>
      <rect className="baseline-bar" x={lane.x} y={y} width={lane.width} height="5" rx="2.5" />
      {lane.varianceWidth > 0 ? <rect className="baseline-variance" x={lane.varianceX} y={y + 6} width={lane.varianceWidth} height="2" rx="1" /> : null}
      {showCode ? <>
        <rect className="baseline-code" x={codeX} y={y - 5} width={44} height="14" rx="4" />
        <text className="baseline-code-label" x={codeX + 22} y={y + 5} textAnchor="middle">{lane.code}</text>
      </> : null}
    </g>
  );
}
