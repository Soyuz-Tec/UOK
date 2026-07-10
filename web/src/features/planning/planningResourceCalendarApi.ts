import { planningMutationJson } from "./planningApi";
import type { PlanningMutationOptions } from "./planningApi";
import type { PlanningResourceCalendarUpdateRequest, PlanningScheduleMutationResult } from "./planningContracts";

export function setPlanningResourceCalendar(token: string, projectId: string, resourceId: string, payload: PlanningResourceCalendarUpdateRequest, mutation: PlanningMutationOptions) {
  return planningMutationJson<PlanningScheduleMutationResult>(token, `/api/planning/projects/${projectId}/resources/${resourceId}/calendar`, { method: "PUT", body: JSON.stringify(payload) }, "planning-resource-calendar-set", mutation);
}
