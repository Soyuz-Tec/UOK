import { useCallback, useEffect, useState } from "react";

import {
  assignPlanningResource,
  createPlanningBaseline,
  createPlanningDependency,
  createPlanningResource,
  createPlanningTask,
  deletePlanningTask,
  loadPlanningSchedule,
  listPlanningProjects,
  planningCommand,
  removePlanningDependency,
  setPlanningCalendar,
  updatePlanningDependency,
  updatePlanningTask,
} from "./planningApi";
import type { PlanningBulkTaskUpdate } from "./PlanningBulkEditControls";
import {
  findDependencyByMatch,
  findTaskByMatch,
  planningHistoryDiff,
  planningLevelHistory,
  type PlanningHistoryEntry,
  type PlanningHistoryState,
  type PlanningHistoryStep,
} from "./planningHistory";
import { planningTaskMenuMutation, type PlanningTaskMenuAction } from "./planningTaskMenuModel";
import { resultId, taskPayload, withCascade } from "./planningWorkspaceHelpers";
import type { PlanningProject, PlanningSchedule, PlanningTask } from "./types";

const historyLimit = 25;

export function usePlanningWorkspaceMutations({
  token,
  operational,
  schedule,
  selectedProjectId,
  setProjects,
  setSchedule,
  setSelectedProjectId,
  setSelectedTaskId,
}: {
  token: string;
  operational: boolean;
  schedule: PlanningSchedule | null;
  selectedProjectId: string;
  setProjects: (projects: PlanningProject[]) => void;
  setSchedule: (schedule: PlanningSchedule | null) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (update: string | ((current: string) => string)) => void;
}) {
  const [status, setStatus] = useState<unknown>("Planning module ready.");
  const [busy, setBusy] = useState("");
  const [undoStack, setUndoStack] = useState<PlanningHistoryEntry[]>([]);
  const [redoStack, setRedoStack] = useState<PlanningHistoryEntry[]>([]);
  const history: PlanningHistoryState = {
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    undoLabel: undoStack.at(-1)?.label || "",
    redoLabel: redoStack.at(-1)?.label || "",
  };

  const reloadSchedule = useCallback(async (projectId: string) => {
    const nextSchedule = await loadPlanningSchedule(token, projectId);
    setSchedule(nextSchedule);
    setSelectedTaskId((current) => nextSchedule.tasks.some((task) => task.id === current) ? current : nextSchedule.tasks[0]?.id || "");
    return nextSchedule;
  }, [setSchedule, setSelectedTaskId, token]);

  const refresh = useCallback(async () => {
    if (!token || !operational) return;
    setBusy("refresh");
    try {
      const rows = await listPlanningProjects(token);
      setProjects(rows);
      const projectId = selectedProjectId || rows[0]?.id || "";
      setSelectedProjectId(projectId);
      if (projectId) await reloadSchedule(projectId);
      else setSchedule(null);
      setStatus({ status: "ready", projects: rows.length });
    } catch (error) {
      setStatus(error);
    } finally {
      setBusy("");
    }
  }, [operational, reloadSchedule, selectedProjectId, setProjects, setSchedule, setSelectedProjectId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    addBaseline,
    addDependency,
    addResource,
    addTask,
    assignResource,
    busy,
    changeProject,
    createDemoSchedule,
    history,
    refresh,
    removeDependency,
    removeTask,
    rescheduleTask,
    runHistory,
    runTaskMenuAction,
    saveCalendar,
    saveDependency,
    saveTask,
    saveTaskBatch,
    status,
    levelResources,
  };

  async function createDemoSchedule() {
    setBusy("demo");
    try {
      const stamp = Date.now();
      const project = await planningCommand<PlanningProject>(token, "CreatePlanningProject", { name: `Gantt Pilot ${stamp}`, start: "2026-08-03", end: "2026-08-28" }, "planning-project");
      const projectId = project.result.id;
      await setPlanningCalendar(token, projectId, { name: "Standard", working_days: [1, 2, 3, 4, 5], holidays: ["2026-08-14"] });
      const summary = await createPlanningTask(token, projectId, taskPayload("Pilot delivery", "2026-08-03", "2026-08-20", 0, 1, "summary"));
      const first = await createPlanningTask(token, projectId, taskPayload("Define schedule scope", "2026-08-03", "2026-08-05", 40, 2, "task", resultId(summary)));
      const second = await createPlanningTask(token, projectId, taskPayload("Build integrated Gantt", "2026-08-06", "2026-08-12", 10, 3, "task", resultId(summary)));
      const milestone = await createPlanningTask(token, projectId, taskPayload("Pilot review milestone", "2026-08-13", "2026-08-13", 0, 4, "milestone", resultId(summary)));
      await createPlanningDependency(token, projectId, { predecessor_task_id: resultId(first), successor_task_id: resultId(second), dependency_type: "finish_to_start", lag_days: 1 });
      await createPlanningDependency(token, projectId, { predecessor_task_id: resultId(second), successor_task_id: resultId(milestone), dependency_type: "finish_to_start", lag_days: 0 });
      const resourceSchedule = await createPlanningResource(token, projectId, { name: "Planner", role: "Scheduling" }) as { resources?: { id: string }[] };
      const resourceId = resourceSchedule.resources?.[0]?.id;
      if (resourceId) await assignPlanningResource(token, { task_id: resultId(second), resource_id: resourceId, allocation_percent: 100 });
      await createPlanningBaseline(token, projectId, { name: "Initial baseline" });
      setProjects(await listPlanningProjects(token));
      setSelectedProjectId(projectId);
      await reloadSchedule(projectId);
      clearHistory();
      setStatus({ status: "created", project_id: projectId });
    } catch (error) {
      setStatus(error);
    } finally {
      setBusy("");
    }
  }

  async function changeProject(projectId: string) {
    setSelectedProjectId(projectId);
    await reloadSchedule(projectId);
    clearHistory();
  }

  async function rescheduleTask(taskId: string, start: string, end: string, cascade = true) {
    await mutate("reschedule", () => updatePlanningTask(token, taskId, { start, end, cascade }), { taskId, start, end, cascade }, "Reschedule task");
  }

  async function saveTask(taskId: string, payload: Record<string, unknown>, cascade = true) {
    await mutate("task", () => updatePlanningTask(token, taskId, withCascade(payload, cascade)), { taskId, cascade }, "Edit task");
  }

  async function saveTaskBatch(updates: PlanningBulkTaskUpdate[]) {
    await mutate("bulk-task", () => Promise.all(updates.map((update) => updatePlanningTask(token, update.taskId, update.payload))), { action: "bulk_task_updated", tasks: updates.length }, "Bulk edit tasks");
  }

  async function addTask(payload: Record<string, unknown>) {
    await mutate("task", () => createPlanningTask(token, selectedProjectId, payload), { action: "task_created" }, "Create task");
  }

  async function removeTask(taskId: string) {
    await mutate("task", () => deletePlanningTask(token, taskId), { taskId, action: "task_deleted" }, "Delete task");
  }

  async function addDependency(payload: Record<string, unknown>) {
    await mutate("dependency", () => createPlanningDependency(token, selectedProjectId, payload), { action: "dependency_created" }, "Create dependency");
  }

  async function saveDependency(dependencyId: string, payload: Record<string, unknown>) {
    await mutate("dependency", () => updatePlanningDependency(token, dependencyId, payload), { dependencyId }, "Edit dependency");
  }

  async function removeDependency(dependencyId: string) {
    await mutate("dependency", () => removePlanningDependency(token, dependencyId), { dependencyId, action: "dependency_removed" }, "Remove dependency");
  }

  async function saveCalendar(payload: Record<string, unknown>) {
    await mutate("calendar", () => setPlanningCalendar(token, selectedProjectId, payload), { action: "calendar_updated" }, "Edit calendar");
  }

  async function addBaseline(payload: Record<string, unknown>) {
    await mutate("baseline", () => createPlanningBaseline(token, selectedProjectId, payload), { action: "baseline_created" });
  }

  async function addResource(payload: Record<string, unknown>) {
    await mutate("resource", () => createPlanningResource(token, selectedProjectId, payload), { action: "resource_created" });
  }

  async function assignResource(payload: Record<string, unknown>) {
    await mutate("resource", () => assignPlanningResource(token, payload), { action: "resource_assigned" }, "Assign resource");
  }

  async function levelResources() {
    await mutate("level", () => planningCommand<PlanningSchedule>(token, "LevelPlanningResources", { project_id: selectedProjectId }, "planning-level"), { action: "resources_leveled" }, "Level resources", planningLevelHistory);
  }

  async function runTaskMenuAction(action: PlanningTaskMenuAction, task: PlanningTask) {
    const mutation = planningTaskMenuMutation(action, task);
    if (!mutation) return;
    if (mutation.kind === "create") await addTask(mutation.payload);
    else if (mutation.kind === "update") await saveTask(mutation.taskId, mutation.payload);
    else await removeTask(mutation.taskId);
  }

  async function mutate(action: string, run: () => Promise<unknown>, okStatus: Record<string, unknown>, label?: string, customHistory = planningHistoryDiff) {
    if (!selectedProjectId) return;
    const before = schedule;
    setBusy(action);
    try {
      await run();
      const after = await reloadSchedule(selectedProjectId);
      if (before && label) pushHistory(customHistory(before, after, label));
      setStatus({ status: "validated", ...okStatus });
    } catch (error) {
      setStatus(error);
      await reloadSchedule(selectedProjectId).catch(() => undefined);
    } finally {
      setBusy("");
    }
  }

  async function runHistory(direction: "undo" | "redo") {
    const source = direction === "undo" ? undoStack : redoStack;
    const entry = source.at(-1);
    if (!entry || !selectedProjectId) return;
    setBusy(direction);
    try {
      for (const step of direction === "undo" ? entry.undo : entry.redo) await runStep(step);
      await reloadSchedule(selectedProjectId);
      if (direction === "undo") {
        setUndoStack((items) => items.slice(0, -1));
        setRedoStack((items) => [...items, entry].slice(-historyLimit));
      } else {
        setRedoStack((items) => items.slice(0, -1));
        setUndoStack((items) => [...items, entry].slice(-historyLimit));
      }
      setStatus({ status: "validated", action: direction, label: entry.label });
    } catch (error) {
      setStatus(error);
      await reloadSchedule(selectedProjectId).catch(() => undefined);
    } finally {
      setBusy("");
    }
  }

  async function runStep(step: PlanningHistoryStep) {
    if (step.kind === "update-task") return updatePlanningTask(token, step.taskId, step.payload);
    if (step.kind === "create-task") return createPlanningTask(token, step.projectId, step.payload);
    if (step.kind === "delete-task") return deletePlanningTask(token, resolvedTaskId(step.taskId, step.match));
    if (step.kind === "update-dependency") return updatePlanningDependency(token, step.dependencyId, step.payload);
    if (step.kind === "create-dependency") return createPlanningDependency(token, step.projectId, step.payload);
    if (step.kind === "remove-dependency") return removePlanningDependency(token, resolvedDependencyId(step.dependencyId, step.match));
    if (step.kind === "set-calendar") return setPlanningCalendar(token, step.projectId, step.payload);
    if (step.kind === "assign-resource") return assignPlanningResource(token, step.payload);
    return planningCommand<PlanningSchedule>(token, "LevelPlanningResources", { project_id: step.projectId }, "planning-level");
  }

  function resolvedTaskId(taskId: string | undefined, match: Record<string, unknown>) {
    if (taskId && schedule?.tasks.some((task) => task.id === taskId)) return taskId;
    const matchedId = schedule ? findTaskByMatch(schedule, match)?.id : "";
    if (!matchedId) throw new Error("Undo task match was not found in the current schedule.");
    return matchedId;
  }

  function resolvedDependencyId(dependencyId: string | undefined, match: Record<string, unknown>) {
    if (dependencyId && schedule?.dependencies.some((dep) => dep.id === dependencyId)) return dependencyId;
    const matchedId = schedule ? findDependencyByMatch(schedule, match)?.id : "";
    if (!matchedId) throw new Error("Undo dependency match was not found in the current schedule.");
    return matchedId;
  }

  function pushHistory(entry: PlanningHistoryEntry | null) {
    if (!entry) return;
    setUndoStack((items) => [...items, entry].slice(-historyLimit));
    setRedoStack([]);
  }

  function clearHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }
}
