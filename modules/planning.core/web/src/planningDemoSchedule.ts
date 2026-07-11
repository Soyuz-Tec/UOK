import {
  assignPlanningResource,
  createPlanningBaseline,
  createPlanningDependency,
  createPlanningProject,
  createPlanningResource,
  createPlanningTask,
  setPlanningCalendar,
  type PlanningStrongEtag,
} from "./planningApi";
import { resultId, taskPayload } from "./planningWorkspaceHelpers";

export async function createPlanningDemoSchedule(token: string) {
  const stamp = Date.now();
  const project = await createPlanningProject(token, {
    name: `Gantt Pilot ${stamp}`,
    start: "2026-08-03",
    end: "2026-08-28",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const projectId = project.data.id;
  let etag = project.etag;

  etag = (await setPlanningCalendar(token, projectId, {
    name: "Standard",
    working_days: [1, 2, 3, 4, 5],
    holidays: ["2026-08-14"],
  }, conditional(etag))).etag;
  const summary = await createPlanningTask(token, projectId, taskPayload("Pilot delivery", "2026-08-03", "2026-08-20", 0, 1, "summary"), conditional(etag));
  etag = summary.etag;
  const first = await createPlanningTask(token, projectId, taskPayload("Define schedule scope", "2026-08-03", "2026-08-05", 40, 2, "task", resultId(summary.data)), conditional(etag));
  etag = first.etag;
  const second = await createPlanningTask(token, projectId, taskPayload("Build integrated Gantt", "2026-08-06", "2026-08-12", 10, 3, "task", resultId(summary.data)), conditional(etag));
  etag = second.etag;
  const milestone = await createPlanningTask(token, projectId, taskPayload("Pilot review milestone", "2026-08-13", "2026-08-13", 0, 4, "milestone", resultId(summary.data)), conditional(etag));
  etag = milestone.etag;
  etag = (await createPlanningDependency(token, projectId, {
    predecessor_task_id: resultId(first.data),
    successor_task_id: resultId(second.data),
    dependency_type: "finish_to_start",
    lag_days: 1,
  }, conditional(etag))).etag;
  etag = (await createPlanningDependency(token, projectId, {
    predecessor_task_id: resultId(second.data),
    successor_task_id: resultId(milestone.data),
    dependency_type: "finish_to_start",
    lag_days: 0,
  }, conditional(etag))).etag;
  const resourceSchedule = await createPlanningResource(token, projectId, { name: "Planner", role: "Scheduling" }, conditional(etag));
  etag = resourceSchedule.etag;
  const resourceId = resourceIdFrom(resourceSchedule.data);
  if (resourceId) {
    const assignment = await assignPlanningResource(token, {
      task_id: resultId(second.data),
      resource_id: resourceId,
      allocation_percent: 100,
    }, conditional(etag));
    etag = assignment.etag;
  }
  etag = (await createPlanningBaseline(token, projectId, { name: "Initial baseline" }, conditional(etag))).etag;
  return { projectId, etag };
}

function conditional(ifMatch: PlanningStrongEtag) {
  return { ifMatch };
}

function resourceIdFrom(value: unknown) {
  if (!value || typeof value !== "object" || !("resources" in value) || !Array.isArray(value.resources)) return "";
  const first = value.resources[0];
  return first && typeof first === "object" && "id" in first && typeof first.id === "string" ? first.id : "";
}
