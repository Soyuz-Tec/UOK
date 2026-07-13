import type {
  PlanningDependency,
  PlanningDependencyType,
  PlanningSchedule,
  PlanningTask,
  PlanningTaskParticipant,
} from "./types";

export type PlanningGanttTranslate = (key: string, fallback?: string) => string;

export type PlanningGridTaskFacts = Map<string, string> & {
  readonly ownersByTask: ReadonlyMap<string, string>;
  readonly ownerParticipantsByTask: ReadonlyMap<string, readonly PlanningTaskParticipant[]>;
  readonly predecessorsByTask: ReadonlyMap<string, string>;
  readonly successorsByTask: ReadonlyMap<string, string>;
};

export function buildPlanningGridTaskFacts(schedule: PlanningSchedule): PlanningGridTaskFacts {
  const resources = new Map(schedule.resources.map((resource) => [resource.id, resource.name]));
  const assignedNames = new Map<string, string[]>();
  const ownerNames = new Map<string, string[]>();
  const ownerParticipantsByTask = new Map<string, PlanningTaskParticipant[]>();
  const predecessorLabels = new Map<string, string[]>();
  const successorLabels = new Map<string, string[]>();
  const taskById = new Map(schedule.tasks.map((task) => [task.id, task]));

  for (const assignment of schedule.assignments) {
    const resourceName = resources.get(assignment.resource_id);
    if (resourceName) appendUnique(assignedNames, assignment.task_id, resourceName);
  }
  for (const participant of schedule.participants || []) {
    if (participant.role !== "owner") continue;
    appendUnique(ownerNames, participant.task_id, planningOwnerLabel(participant));
    appendUniqueParticipant(ownerParticipantsByTask, participant.task_id, participant);
  }
  for (const dependency of schedule.dependencies) {
    const predecessor = taskById.get(dependency.predecessor_task_id);
    const successor = taskById.get(dependency.successor_task_id);
    appendUnique(predecessorLabels, dependency.successor_task_id, dependencyDisplay(predecessor, dependency));
    appendUnique(successorLabels, dependency.predecessor_task_id, dependencyDisplay(successor, dependency));
  }

  const facts = joinedMap(assignedNames, ", ") as PlanningGridTaskFacts;
  Object.defineProperties(facts, {
    ownersByTask: { enumerable: false, value: joinedMap(ownerNames) },
    ownerParticipantsByTask: { enumerable: false, value: ownerParticipantsByTask },
    predecessorsByTask: { enumerable: false, value: joinedMap(predecessorLabels) },
    successorsByTask: { enumerable: false, value: joinedMap(successorLabels) },
  });
  return facts;
}

export function planningOwnerLabel(participant: PlanningTaskParticipant, t: PlanningGanttTranslate = fallbackTranslate) {
  const label = participant.resolution.display_label?.trim();
  if (participant.resolution.status === "ready") return label || t("planning.owner.unavailable", "Owner unavailable");
  if (participant.resolution.status === "unavailable") {
    return label ? `${label} (${t("planning.owner.state.unavailable", "unavailable")})` : t("planning.owner.unavailable", "Owner unavailable");
  }
  if (participant.resolution.status === "denied") return t("planning.owner.restricted", "Restricted owner");
  return t("planning.owner.missing", "Missing owner");
}

export function planningDependencyTypeCode(dependencyType: PlanningDependencyType) {
  if (dependencyType === "start_to_start") return "SS";
  if (dependencyType === "finish_to_finish") return "FF";
  if (dependencyType === "start_to_finish") return "SF";
  return "FS";
}

export function planningDependencyLagLabel(lagDays: number) {
  if (!lagDays) return "";
  return ` ${lagDays > 0 ? "+" : ""}${lagDays}d`;
}

export function planningTaskReference(task: PlanningTask | undefined) {
  if (!task) return "Unknown task";
  const title = task.title.trim();
  const wbs = task.wbs?.trim();
  if (wbs && title) return `${wbs} · ${title}`;
  return wbs || title || "Untitled task";
}

function dependencyDisplay(task: PlanningTask | undefined, dependency: PlanningDependency) {
  return `${planningTaskReference(task)} · ${planningDependencyTypeCode(dependency.dependency_type)}${planningDependencyLagLabel(dependency.lag_days)}`;
}

function appendUnique(valuesByTask: Map<string, string[]>, taskId: string, value: string) {
  const values = valuesByTask.get(taskId) || [];
  if (!values.includes(value)) values.push(value);
  valuesByTask.set(taskId, values);
}

function appendUniqueParticipant(valuesByTask: Map<string, PlanningTaskParticipant[]>, taskId: string, value: PlanningTaskParticipant) {
  const values = valuesByTask.get(taskId) || [];
  if (!values.some((participant) => participant.id === value.id)) values.push(value);
  valuesByTask.set(taskId, values);
}

function joinedMap(valuesByTask: Map<string, string[]>, separator = "; ") {
  return new Map(Array.from(valuesByTask.entries()).map(([taskId, values]) => [taskId, values.join(separator)]));
}

function fallbackTranslate(_key: string, fallback?: string) {
  return fallback || _key;
}
