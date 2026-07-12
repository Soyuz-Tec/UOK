import { createPlanningProject, listPlanningProjects } from "./planningApi";
import type { PlanningProjectCreateRequest } from "./planningContracts";
import type { PlanningProject } from "./types";

export async function createPlanningWorkspaceProject({
  token,
  payload,
  current,
  onCreated,
  onProjects,
  reloadSchedule,
}: {
  token: string;
  payload: PlanningProjectCreateRequest;
  current: () => boolean;
  onCreated: (project: PlanningProject) => void;
  onProjects: (projects: PlanningProject[]) => void;
  reloadSchedule: (projectId: string) => Promise<unknown>;
}) {
  const created = await createPlanningProject(token, payload);
  if (!current()) return { project: created.data, reloadError: null };
  onCreated(created.data);
  let reloadError: unknown = null;
  try {
    const projects = await listPlanningProjects(token);
    if (current()) onProjects(projects.some((project) => project.id === created.data.id) ? projects : [...projects, created.data]);
  } catch (error) {
    reloadError = error;
  }
  try {
    if (current()) await reloadSchedule(created.data.id);
  } catch (error) {
    reloadError ||= error;
  }
  return { project: created.data, reloadError };
}
