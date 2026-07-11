import type { PlanningTask } from "./types";

export type PlanningTaskIndicator = { code: string; label: string };

export const taskTooltipWidth = 224;
export const taskTooltipHeight = 34;
export const taskOverlayGutter = 72;

const chartEdgeGap = 4;
const overlayGap = 8;
const minimumVisibleLabelWidth = 18;
const maximumVisibleLabelWidth = 240;

export function statusCodeWidth(code: string) {
  return Math.max(34, code.length * 7 + 12);
}

export function taskOverlayGeometry({
  barWidth,
  barX,
  hasHandles,
  headerHeight,
  indicatorWidth,
  progressHandleX,
  rowSize,
  rowTop,
  timelineWidth,
  viewportLeft = 0,
  viewportWidth = timelineWidth,
}: {
  barWidth: number;
  barX: number;
  hasHandles: boolean;
  headerHeight: number;
  indicatorWidth: number;
  progressHandleX?: number;
  rowSize: number;
  rowTop: number;
  timelineWidth: number;
  viewportLeft?: number;
  viewportWidth?: number;
}) {
  const barRight = barX + barWidth;
  const insideIndicatorX = barRight - indicatorWidth - 5;
  const progressClearsIndicator = !hasHandles
    || progressHandleX === undefined
    || progressHandleX + 7 <= insideIndicatorX;
  const indicatorX = barWidth > indicatorWidth + 72 && progressClearsIndicator
    ? insideIndicatorX
    : barRight + 6;
  const indicatorRight = indicatorX + indicatorWidth;
  const sourceHandleX = Math.max(barRight + 12, indicatorRight + 12);
  const labelX = barX + 8;
  const labelRight = Math.min(barRight - 4, indicatorX - 6);
  const labelWidth = Math.min(maximumVisibleLabelWidth, Math.max(0, labelRight - labelX));
  const interactiveRight = Math.max(
    barRight,
    indicatorRight,
    hasHandles ? sourceHandleX + 5 : indicatorRight,
  );
  const viewportStart = Math.max(chartEdgeGap, Math.min(timelineWidth, viewportLeft) + chartEdgeGap);
  const viewportEnd = Math.min(timelineWidth - chartEdgeGap, viewportLeft + Math.max(taskTooltipWidth + chartEdgeGap * 2, viewportWidth) - chartEdgeGap);
  const rightTooltipX = interactiveRight + overlayGap;
  const leftTooltipX = barX - overlayGap - taskTooltipWidth;
  const maximumTooltipX = Math.max(viewportStart, viewportEnd - taskTooltipWidth);
  const tooltipX = rightTooltipX + taskTooltipWidth <= viewportEnd
    ? rightTooltipX
    : leftTooltipX >= viewportStart
      ? leftTooltipX
      : Math.min(maximumTooltipX, Math.max(viewportStart, barX));
  const tooltipY = headerHeight + rowTop + Math.max(0, (rowSize - taskTooltipHeight) / 2);

  return {
    indicatorX,
    indicatorRight,
    labelWidth: labelWidth >= minimumVisibleLabelWidth ? labelWidth : 0,
    labelX,
    sourceHandleX,
    tooltipX,
    tooltipY,
  };
}

export function TaskStatusCode({ x, y, indicator }: { x: number; y: number; indicator: PlanningTaskIndicator }) {
  const width = statusCodeWidth(indicator.code);
  return (
    <g className="planning-owned-status-code" aria-label={indicator.label}>
      <rect className="planning-owned-status-surface" x={x} y={y} width={width} height="18" rx="4" />
      <text x={x + width / 2} y={y + 13} textAnchor="middle">{indicator.code}</text>
    </g>
  );
}

export function TaskLabelViewport({ clipId, height, title, width, x, y }: {
  clipId: string;
  height: number;
  title: string;
  width: number;
  x: number;
  y: number;
}) {
  if (width < minimumVisibleLabelWidth) return null;
  return (
    <g aria-hidden="true">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <rect className="planning-owned-task-label-viewport" x={x} y={y + 2} width={width} height={Math.max(1, height - 4)} rx="3" />
      <text className="planning-owned-task-label" x={x} y={y + height / 2 + 4} clipPath={`url(#${clipId})`}>{title}</text>
    </g>
  );
}

export function TaskTooltip({ clipIdPrefix, task, x, y, indicator }: {
  clipIdPrefix: string;
  task: PlanningTask;
  x: number;
  y: number;
  indicator: PlanningTaskIndicator;
}) {
  const titleClipId = `${clipIdPrefix}-title`;
  const detailClipId = `${clipIdPrefix}-detail`;
  const lineX = x + 10;
  const lineWidth = taskTooltipWidth - 20;
  return (
    <g className="planning-owned-tooltip" aria-hidden="true">
      <defs>
        <clipPath id={titleClipId} clipPathUnits="userSpaceOnUse">
          <rect x={lineX} y={y + 2} width={lineWidth} height="15" />
        </clipPath>
        <clipPath id={detailClipId} clipPathUnits="userSpaceOnUse">
          <rect x={lineX} y={y + 17} width={lineWidth} height="15" />
        </clipPath>
      </defs>
      <rect className="planning-owned-tooltip-surface" x={x} y={y} width={taskTooltipWidth} height={taskTooltipHeight} rx="6" />
      <text className="planning-owned-tooltip-line" x={lineX} y={y + 14} clipPath={`url(#${titleClipId})`}>{task.wbs ? `${task.wbs} ` : ""}{task.title}</text>
      <text className="planning-owned-tooltip-line muted" x={lineX} y={y + 28} clipPath={`url(#${detailClipId})`}>{indicator.label} · {task.start} to {task.end} · {task.progress}%</text>
    </g>
  );
}
