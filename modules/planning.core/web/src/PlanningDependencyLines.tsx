import { useId } from "react";

import { useUokLocalization } from "@uok/shared/localization";
import type { PlanningDependencyChain } from "./planningDependencyChain";
import {
  buildPlanningDependencyRoutes,
  planningDependencyLagLabel,
  planningDependencyTypeLabel,
} from "./planningDependencyGeometry";
import type { TimelineScale } from "./planningGanttModel";
import type { PlanningRowLayout } from "./planningRowHeights";
import type { PlanningSchedule, PlanningTask } from "./types";

export function DependencyLines({
  schedule,
  tasks,
  rowLayoutByTask,
  chartStart,
  scale,
  cellWidth,
  headerHeight,
  dependencyChain,
  timelineWidth,
}: {
  schedule: PlanningSchedule;
  tasks: PlanningTask[];
  rowLayoutByTask: Map<string, PlanningRowLayout>;
  chartStart: Date;
  scale: TimelineScale;
  cellWidth: number;
  headerHeight: number;
  dependencyChain: PlanningDependencyChain;
  timelineWidth?: number;
}) {
  const markerPrefix = useId().replace(/:/g, "");
  const { formatNumber, t } = useUokLocalization();
  const normalMarkerId = `${markerPrefix}-dependency-arrow`;
  const selectedMarkerId = `${markerPrefix}-dependency-arrow-selected`;
  const routes = buildPlanningDependencyRoutes({
    dependencies: schedule.dependencies,
    tasks,
    rowLayoutByTask,
    chartStart,
    scale,
    cellWidth,
    headerHeight,
    timelineWidth,
  });
  return (
    <g className="planning-owned-dependencies">
      <defs aria-hidden="true">
        <DependencyArrowMarker id={normalMarkerId} />
        <DependencyArrowMarker id={selectedMarkerId} selected />
      </defs>
      {routes.map((route) => {
        const selected = dependencyChain.dependencyIds.has(route.dependency.id);
        const quietDefault = route.dependency.dependency_type === "finish_to_start" && route.dependency.lag_days === 0;
        const label = accessibilityLabel(route, selected, {
          dependency: t("planning.dependency.label", "Dependency"),
          from: t("planning.dependency.from", "from"),
          to: t("planning.dependency.to", "to"),
          type: t(`planning.dependency.type.${route.dependency.dependency_type}`, planningDependencyTypeLabel(route.dependency.dependency_type)),
          lag: planningDependencyLagLabel(route.dependency.lag_days, {
            none: t("planning.dependency.lag.none", "No lag"),
            positive: t("planning.dependency.lag.positive", "Lag"),
            negative: t("planning.dependency.lag.negative", "Lead"),
            day: t("planning.dependency.day", "day"),
            days: t("planning.dependency.days", "days"),
          }).replace(String(Math.abs(route.dependency.lag_days)), formatNumber(Math.abs(route.dependency.lag_days))),
          selectedChain: t("planning.dependency.selectedChain", "Selected dependency chain"),
        });
        const labelWidth = Math.max(24, route.compactLabel.length * 6.5 + 10);
        return (
          <g
            key={route.dependency.id}
            className={`planning-owned-dependency dependency-${route.dependency.dependency_type}${quietDefault ? " quiet-default" : ""}${selected ? " chain-highlight selected-chain" : ""}`}
            data-dependency-id={route.dependency.id}
            data-source-port={route.sourcePort}
            data-target-port={route.targetPort}
            role="img"
            aria-label={label}
          >
            <title>{label}</title>
            <path
              className={`planning-owned-dependency-line${selected ? " chain-highlight" : ""}`}
              d={route.path}
              markerEnd={`url(#${selected ? selectedMarkerId : normalMarkerId})`}
              vectorEffect="non-scaling-stroke"
            />
            <g className="planning-owned-dependency-label" aria-hidden="true">
              <rect x={route.labelX - labelWidth / 2} y={route.labelY - 10} width={labelWidth} height="16" rx="4" />
              <text x={route.labelX} y={route.labelY + 2} textAnchor="middle">{route.compactLabel}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}

function DependencyArrowMarker({ id, selected = false }: { id: string; selected?: boolean }) {
  return (
    <marker id={id} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto" markerUnits="userSpaceOnUse">
      <path className={`planning-owned-dependency-arrow${selected ? " chain-highlight" : ""}`} d="M 0 0 L 8 4 L 0 8 Z" />
    </marker>
  );
}

function accessibilityLabel(
  route: ReturnType<typeof buildPlanningDependencyRoutes>[number],
  selected: boolean,
  labels: { dependency: string; from: string; to: string; type: string; lag: string; selectedChain: string },
) {
  return `${labels.type} ${labels.dependency} ${labels.from} ${route.sourceTask.title} ${labels.to} ${route.targetTask.title}; ${labels.lag}${selected ? `; ${labels.selectedChain}` : ""}`;
}
