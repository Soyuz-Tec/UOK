import { dateValue, durationUnits, xForDate, type TimelineScale } from "./planningGanttModel";
import type { PlanningRowLayout } from "./planningRowHeights";
import type { PlanningDependency, PlanningDependencyType, PlanningTask } from "./types";

export type PlanningDependencyPort = "start" | "finish";

export type PlanningDependencyRoute = {
  dependency: PlanningDependency;
  sourceTask: PlanningTask;
  targetTask: PlanningTask;
  sourcePort: PlanningDependencyPort;
  targetPort: PlanningDependencyPort;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  laneX: number;
  labelX: number;
  labelY: number;
  compactLabel: string;
  path: string;
};

type TaskGeometry = {
  task: PlanningTask;
  row: PlanningRowLayout;
  startX: number;
  finishX: number;
  centerY: number;
};

type RouteCandidate = {
  dependency: PlanningDependency;
  source: TaskGeometry;
  target: TaskGeometry;
  sourcePort: PlanningDependencyPort;
  targetPort: PlanningDependencyPort;
  sourceX: number;
  sourceExitX: number;
  targetX: number;
  targetEntryX: number;
  clearance: number;
};

const portByType: Record<PlanningDependencyType, { source: PlanningDependencyPort; target: PlanningDependencyPort }> = {
  finish_to_start: { source: "finish", target: "start" },
  start_to_start: { source: "start", target: "start" },
  finish_to_finish: { source: "finish", target: "finish" },
  start_to_finish: { source: "start", target: "finish" },
};

const codeByType: Record<PlanningDependencyType, string> = {
  finish_to_start: "FS",
  start_to_start: "SS",
  finish_to_finish: "FF",
  start_to_finish: "SF",
};

const labelByType: Record<PlanningDependencyType, string> = {
  finish_to_start: "Finish-to-start",
  start_to_start: "Start-to-start",
  finish_to_finish: "Finish-to-finish",
  start_to_finish: "Start-to-finish",
};

export function planningDependencyPorts(type: PlanningDependencyType) {
  return portByType[type];
}

export function planningDependencyTypeCode(type: PlanningDependencyType) {
  return codeByType[type];
}

export function planningDependencyTypeLabel(type: PlanningDependencyType) {
  return labelByType[type];
}

export function planningDependencyCompactLabel(type: PlanningDependencyType, lagDays: number) {
  const lag = lagDays > 0 ? ` +${lagDays}d` : lagDays < 0 ? ` ${lagDays}d` : "";
  return `${planningDependencyTypeCode(type)}${lag}`;
}

export function planningDependencyLagLabel(lagDays: number, labels = { none: "No lag", positive: "Lag", negative: "Lead", day: "day", days: "days" }) {
  if (lagDays === 0) return labels.none;
  const amount = Math.abs(lagDays);
  return `${lagDays > 0 ? labels.positive : labels.negative} ${amount} ${amount === 1 ? labels.day : labels.days}`;
}

export function buildPlanningDependencyRoutes({
  dependencies,
  tasks,
  rowLayoutByTask,
  chartStart,
  scale,
  cellWidth,
  headerHeight,
  timelineWidth,
}: {
  dependencies: PlanningDependency[];
  tasks: PlanningTask[];
  rowLayoutByTask: Map<string, PlanningRowLayout>;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  headerHeight: number;
  timelineWidth?: number;
}): PlanningDependencyRoute[] {
  const geometry = taskGeometryById(tasks, rowLayoutByTask, chartStart, scale, cellWidth, headerHeight);
  const candidates = dependencies
    .map((dependency) => routeCandidate(dependency, geometry, cellWidth))
    .filter((candidate): candidate is RouteCandidate => Boolean(candidate))
    .sort(compareCandidates);
  const globalRightEdge = Math.max(0, ...Array.from(geometry.values(), (task) => task.finishX));
  const taskObstacles = Array.from(geometry.values());
  const laneSpacing = Math.max(8, Math.min(14, cellWidth * 0.25));
  const maxLaneX = timelineWidth === undefined ? Number.POSITIVE_INFINITY : Math.max(32, timelineWidth - 32);
  const routes: PlanningDependencyRoute[] = [];

  for (const candidate of candidates) {
    const yRange = dependencyYRange(candidate);
    const positions = lanePositions(candidate, globalRightEdge, laneSpacing, routes.length + 2, maxLaneX);
    const lane = positions.find((position) => !laneIntersectsTask(position.x, yRange, taskObstacles)
      && routes.every((route) => !rangesOverlap(yRange, routeYRange(route)) || Math.abs(route.laneX - position.x) >= laneSpacing * 0.8))
      || positions[positions.length - 1];
    routes.push(buildRoute(candidate, lane.x, lane.exterior));
  }
  return routes;
}

function taskGeometryById(tasks: PlanningTask[], rows: Map<string, PlanningRowLayout>, chartStart: Date, scale: TimelineScale, cellWidth: number, headerHeight: number) {
  const geometry = new Map<string, TaskGeometry>();
  for (const task of tasks) {
    const row = rows.get(task.id);
    if (!row) continue;
    const startX = xForDate(dateValue(task.start), chartStart, scale, cellWidth);
    const barHeight = Math.max(18, row.height * 0.46);
    const width = task.task_type === "milestone" ? barHeight : Math.max(cellWidth * durationUnits(task, scale), cellWidth * 0.65);
    geometry.set(task.id, {
      task,
      row,
      startX,
      finishX: startX + width,
      centerY: headerHeight + row.top + Math.max(7, row.height * 0.22) + barHeight / 2,
    });
  }
  return geometry;
}

function routeCandidate(dependency: PlanningDependency, geometry: Map<string, TaskGeometry>, cellWidth: number): RouteCandidate | null {
  const source = geometry.get(dependency.predecessor_task_id);
  const target = geometry.get(dependency.successor_task_id);
  if (!source || !target) return null;
  const ports = planningDependencyPorts(dependency.dependency_type);
  const clearance = Math.max(8, Math.min(18, cellWidth * 0.35));
  const sourceX = portX(source, ports.source);
  const targetX = portX(target, ports.target);
  return {
    dependency,
    source,
    target,
    sourcePort: ports.source,
    targetPort: ports.target,
    sourceX,
    sourceExitX: sourceX + portDirection(ports.source) * clearance,
    targetX,
    targetEntryX: targetX + portDirection(ports.target) * clearance,
    clearance,
  };
}

function compareCandidates(left: RouteCandidate, right: RouteCandidate) {
  const leftTop = Math.min(left.source.centerY, left.target.centerY);
  const rightTop = Math.min(right.source.centerY, right.target.centerY);
  return leftTop - rightTop
    || Math.max(left.source.centerY, left.target.centerY) - Math.max(right.source.centerY, right.target.centerY)
    || left.dependency.id.localeCompare(right.dependency.id);
}

function lanePositions(candidate: RouteCandidate, globalRightEdge: number, spacing: number, count: number, maxLaneX: number) {
  const positions: Array<{ x: number; exterior: boolean }> = [];
  const low = Math.min(candidate.sourceExitX, candidate.targetEntryX);
  const high = Math.max(candidate.sourceExitX, candidate.targetEntryX);
  const portsFace = candidate.sourcePort !== candidate.targetPort
    && (candidate.targetEntryX - candidate.sourceExitX) * portDirection(candidate.sourcePort) > 0;
  if (portsFace && high - low >= 6) {
    const center = (low + high) / 2;
    for (let index = 0; index < count; index += 1) {
      const offset = index === 0 ? 0 : Math.ceil(index / 2) * spacing * (index % 2 === 1 ? 1 : -1);
      const x = center + offset;
      if (x > low + 3 && x < high - 3 && x <= maxLaneX) addLanePosition(positions, x, false);
    }
  }
  const exteriorStart = globalRightEdge + candidate.clearance;
  for (let index = 0; index < count; index += 1) {
    const x = exteriorStart + index * spacing;
    if (x <= maxLaneX) addLanePosition(positions, x, true);
  }
  if (Number.isFinite(maxLaneX)) {
    for (let index = 0; index < count && maxLaneX - index * spacing >= 32; index += 1) {
      addLanePosition(positions, maxLaneX - index * spacing, true);
    }
  }
  if (positions.length === 0) positions.push({ x: Number.isFinite(maxLaneX) ? maxLaneX : exteriorStart, exterior: true });
  return positions;
}

function addLanePosition(positions: Array<{ x: number; exterior: boolean }>, x: number, exterior: boolean) {
  if (!positions.some((position) => position.x === x)) positions.push({ x, exterior });
}

function buildRoute(candidate: RouteCandidate, laneX: number, exterior: boolean): PlanningDependencyRoute {
  const sourceY = candidate.source.centerY;
  const targetY = candidate.target.centerY;
  const downward = targetY >= sourceY;
  const sourceChannelY = downward
    ? candidate.source.row.top + candidate.source.row.height - 3
    : candidate.source.row.top + 3;
  const targetChannelY = downward
    ? candidate.target.row.top + 3
    : candidate.target.row.top + candidate.target.row.height - 3;
  const headerOffset = sourceY - (candidate.source.row.top + Math.max(7, candidate.source.row.height * 0.22) + Math.max(18, candidate.source.row.height * 0.46) / 2);
  const channelSourceY = headerOffset + sourceChannelY;
  const channelTargetY = headerOffset + targetChannelY;
  const points = exterior
    ? [
        [candidate.sourceX, sourceY], [candidate.sourceExitX, sourceY], [candidate.sourceExitX, channelSourceY],
        [laneX, channelSourceY], [laneX, channelTargetY], [candidate.targetEntryX, channelTargetY],
        [candidate.targetEntryX, targetY], [candidate.targetX, targetY],
      ]
    : [
        [candidate.sourceX, sourceY], [candidate.sourceExitX, sourceY], [laneX, sourceY],
        [laneX, targetY], [candidate.targetEntryX, targetY], [candidate.targetX, targetY],
      ];
  return {
    dependency: candidate.dependency,
    sourceTask: candidate.source.task,
    targetTask: candidate.target.task,
    sourcePort: candidate.sourcePort,
    targetPort: candidate.targetPort,
    sourceX: candidate.sourceX,
    sourceY,
    targetX: candidate.targetX,
    targetY,
    laneX,
    labelX: laneX,
    labelY: (exterior ? channelSourceY + channelTargetY : sourceY + targetY) / 2,
    compactLabel: planningDependencyCompactLabel(candidate.dependency.dependency_type, candidate.dependency.lag_days),
    path: pathFromPoints(points),
  };
}

function dependencyYRange(candidate: RouteCandidate): [number, number] {
  return [Math.min(candidate.source.centerY, candidate.target.centerY), Math.max(candidate.source.centerY, candidate.target.centerY)];
}

function routeYRange(route: PlanningDependencyRoute): [number, number] {
  return [Math.min(route.sourceY, route.targetY), Math.max(route.sourceY, route.targetY)];
}

function rangesOverlap(left: [number, number], right: [number, number]) {
  return left[0] <= right[1] && right[0] <= left[1];
}

function laneIntersectsTask(laneX: number, routeRange: [number, number], tasks: TaskGeometry[]) {
  return tasks.some((task) => routeRange[0] < task.centerY
    && task.centerY < routeRange[1]
    && task.startX - 4 <= laneX
    && laneX <= task.finishX + 4);
}

function portX(task: TaskGeometry, port: PlanningDependencyPort) {
  return port === "start" ? task.startX : task.finishX;
}

function portDirection(port: PlanningDependencyPort) {
  return port === "start" ? -1 : 1;
}

function pathFromPoints(points: number[][]) {
  const unique = points.filter((point, index) => index === 0 || point[0] !== points[index - 1][0] || point[1] !== points[index - 1][1]);
  return unique.map((point, index) => `${index === 0 ? "M" : "L"} ${coordinate(point[0])} ${coordinate(point[1])}`).join(" ");
}

function coordinate(value: number) {
  return Math.round(value * 100) / 100;
}
