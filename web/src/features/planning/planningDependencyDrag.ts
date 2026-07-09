import type { PlanningSchedule } from "./types";

export type DependencyLinkDrag = {
  sourceTaskId: string;
  sourceX: number;
  sourceY: number;
  pointerX: number;
  pointerY: number;
};

export type DependencyLinkPayload = {
  predecessor_task_id: string;
  successor_task_id: string;
  dependency_type: "finish_to_start";
  lag_days: number;
};

export function dependencyLinkPayload(schedule: PlanningSchedule, sourceTaskId: string, targetTaskId: string): DependencyLinkPayload | null {
  if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return null;
  const hasExisting = schedule.dependencies.some((dependency) => (
    dependency.predecessor_task_id === sourceTaskId && dependency.successor_task_id === targetTaskId
  ));
  if (hasExisting) return null;
  return {
    predecessor_task_id: sourceTaskId,
    successor_task_id: targetTaskId,
    dependency_type: "finish_to_start",
    lag_days: 0,
  };
}

export function svgPointer(svg: SVGSVGElement, clientX: number, clientY: number) {
  const rect = svg.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}
