import type { PlanningSchedule, PlanningTask, PlanningTaskFlow } from "../../web/src/types";

export const taskFlow: PlanningTaskFlow = {
  schema_version: 1,
  statuses: [
    { status: "planned", display_label: "Planned", allowed_transitions: ["in_progress", "blocked", "complete"] },
    { status: "in_progress", display_label: "In progress", allowed_transitions: ["planned", "blocked", "complete"] },
    { status: "blocked", display_label: "Blocked", allowed_transitions: ["planned", "in_progress", "complete"] },
    { status: "complete", display_label: "Complete", allowed_transitions: ["planned", "in_progress"] },
  ],
};

export function planningTask(id: string, title: string, status: PlanningTask["status"], sortOrder: number): PlanningTask {
  return {
    id,
    project_id: "project-1",
    version: 1,
    wbs: String(sortOrder),
    title,
    task_type: "task",
    status,
    start: "2026-08-03",
    end: "2026-08-05",
    duration_days: 3,
    progress: status === "complete" ? 100 : 25,
    sort_order: sortOrder,
    critical: id === "scope",
    readiness: { ready: id !== "release", required_count: 1, blocking_count: id === "release" ? 1 : 0, blocking_requirement_ids: id === "release" ? ["gate-1"] : [] },
  };
}

export function planningSchedule(): PlanningSchedule {
  return {
    project: { id: "project-1", name: "Pilot", status: "active", start: "2026-08-01", end: "2026-08-20", target_finish: "2026-08-20", calculated_finish: "2026-08-20", revision: 1 },
    task_flow: taskFlow,
    tasks: [
      planningTask("scope", "Define scope", "planned", 1),
      planningTask("build", "Build release", "in_progress", 2),
      planningTask("release", "Release approval", "planned", 3),
    ],
    dependencies: [],
    resources: [],
    assignments: [],
    links: [],
    baselines: [],
    validation: { ok: true, violations: [] },
  };
}
