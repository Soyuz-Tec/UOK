import type { PlanningSchedule, PlanningTask } from "./types";

export type PlanningCriticalPathItem = {
  id: string;
  label: string;
  slack: number;
  wbs: string;
  window: string;
};

export type PlanningCriticalPathSummary = {
  criticalCount: number;
  calculatedFinish: string | null;
  targetFinish: string | null;
  targetVarianceDays: number | null;
  engineVersion: string | null;
  items: PlanningCriticalPathItem[];
  zeroSlackCount: number;
};

export function planningCriticalPathSummary(schedule: PlanningSchedule): PlanningCriticalPathSummary {
  const criticalTasks = schedule.tasks
    .filter((task) => task.task_type !== "summary" && (task.critical || (task.total_slack_days ?? 0) === 0))
    .sort(compareCriticalTasks);
  return {
    criticalCount: criticalTasks.length,
    calculatedFinish: schedule.calculation?.calculated_finish ?? null,
    targetFinish: schedule.calculation?.target_finish ?? null,
    targetVarianceDays: schedule.calculation?.target_variance_days ?? null,
    engineVersion: schedule.calculation?.engine_version ?? null,
    items: criticalTasks.slice(0, 6).map((task) => ({
      id: task.id,
      label: task.title,
      slack: task.total_slack_days ?? 0,
      wbs: task.wbs || "-",
      window: `${task.start} to ${task.end}`,
    })),
    zeroSlackCount: criticalTasks.filter((task) => (task.total_slack_days ?? 0) === 0).length,
  };
}

export function planningTargetVarianceLabel(value: number | null) {
  if (value === null) return "Not calculated";
  if (value === 0) return "On target";
  return `${Math.abs(value)}d ${value > 0 ? "late" : "early"}`;
}

function compareCriticalTasks(a: PlanningTask, b: PlanningTask) {
  const start = (a.early_start || a.start).localeCompare(b.early_start || b.start);
  if (start) return start;
  return (a.wbs || "").localeCompare(b.wbs || "", undefined, { numeric: true });
}
