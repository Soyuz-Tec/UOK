import { FolderKanban, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState, StatusPill } from "../../shared/data-display";
import { Pane, WorkflowHeader, WorkflowSplitView } from "../../shared/layout";
import { CommandButton } from "../../shared/primitives";
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
import { PlanningGantt } from "./PlanningGantt";
import { PlanningInspector } from "./PlanningInspector";
import { PLANNING_MODULE_ID } from "./planningModule";
import type { PlanningProject, PlanningSchedule, PlanningTask, PlanningWorkspaceProps } from "./types";

export function PlanningWorkspace({ token, appearance, module, busyAction, onActivate }: PlanningWorkspaceProps) {
  const [projects, setProjects] = useState<PlanningProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [schedule, setSchedule] = useState<PlanningSchedule | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [status, setStatus] = useState<unknown>("Planning module ready.");
  const [busy, setBusy] = useState("");
  const operational = module?.status === "installed" || module?.status === "upgraded";
  const selectedTask = useMemo(
    () => schedule?.tasks.find((task) => task.id === selectedTaskId) || schedule?.tasks[0] || null,
    [schedule, selectedTaskId],
  );

  const reloadSchedule = useCallback(async (projectId: string) => {
    const nextSchedule = await loadPlanningSchedule(token, projectId);
    setSchedule(nextSchedule);
    setSelectedTaskId((current) => nextSchedule.tasks.some((task) => task.id === current) ? current : nextSchedule.tasks[0]?.id || "");
    return nextSchedule;
  }, [token]);

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
  }, [operational, reloadSchedule, selectedProjectId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!token) return <EmptyState text="Sign in to open Planning." />;
  if (!operational) return <PlanningModuleState module={module} busyAction={busyAction} onActivate={onActivate} />;

  return (
    <section className="planning-workspace" aria-label="Planning">
      <WorkflowHeader
        eyebrow="Planning"
        title="Project schedule"
        summary={schedule ? `${schedule.tasks.length} tasks, ${schedule.dependencies.length} dependencies` : "Create a plan to begin."}
      >
        <>
          <CommandButton icon={FolderKanban} onClick={() => void createDemoSchedule()} loading={busy === "demo"} primary>
            New sample plan
          </CommandButton>
          <CommandButton icon={RefreshCw} onClick={() => void refresh()} loading={busy === "refresh"}>
            Refresh
          </CommandButton>
        </>
      </WorkflowHeader>
      {!schedule ? (
        <Pane title="No plans" description="Planning workspace" wide>
          <EmptyState text="Create a sample plan to load the validated Gantt read model." />
        </Pane>
      ) : (
        <WorkflowSplitView
          primaryLabel="Planning timeline"
          secondaryLabel="Planning inspector"
          primary={<PlanningGantt schedule={schedule} appearance={appearance} onTaskReschedule={rescheduleTask} />}
          secondary={(
            <PlanningInspector
              projects={projects}
              schedule={schedule}
              selectedTask={selectedTask}
              selectedTaskId={selectedTaskId}
              status={status}
              busy={busy}
              onProjectChange={changeProject}
              onTaskSelect={setSelectedTaskId}
              onSaveTask={saveTask}
              onCreateTask={addTask}
              onDeleteTask={removeTask}
              onCreateDependency={addDependency}
              onUpdateDependency={saveDependency}
              onRemoveDependency={removeDependency}
              onSetCalendar={saveCalendar}
              onCreateBaseline={addBaseline}
              onCreateResource={addResource}
              onAssignResource={assignResource}
            />
          )}
        />
      )}
    </section>
  );

  async function createDemoSchedule() {
    setBusy("demo");
    try {
      const stamp = Date.now();
      const project = await planningCommand<PlanningProject>(token, "CreatePlanningProject", {
        name: `Gantt Pilot ${stamp}`,
        start: "2026-08-03",
        end: "2026-08-28",
      }, "planning-project");
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
  }

  async function rescheduleTask(taskId: string, start: string, end: string) {
    await mutate("reschedule", () => updatePlanningTask(token, taskId, { start, end }), { taskId, start, end });
  }

  async function saveTask(taskId: string, payload: Record<string, unknown>) {
    await mutate("task", () => updatePlanningTask(token, taskId, payload), { taskId });
  }

  async function addTask(payload: Record<string, unknown>) {
    await mutate("task", () => createPlanningTask(token, selectedProjectId, payload), { action: "task_created" });
  }

  async function removeTask(taskId: string) {
    await mutate("task", () => deletePlanningTask(token, taskId), { taskId, action: "task_deleted" });
  }

  async function addDependency(payload: Record<string, unknown>) {
    await mutate("dependency", () => createPlanningDependency(token, selectedProjectId, payload), { action: "dependency_created" });
  }

  async function saveDependency(dependencyId: string, payload: Record<string, unknown>) {
    await mutate("dependency", () => updatePlanningDependency(token, dependencyId, payload), { dependencyId });
  }

  async function removeDependency(dependencyId: string) {
    await mutate("dependency", () => removePlanningDependency(token, dependencyId), { dependencyId, action: "dependency_removed" });
  }

  async function saveCalendar(payload: Record<string, unknown>) {
    await mutate("calendar", () => setPlanningCalendar(token, selectedProjectId, payload), { action: "calendar_updated" });
  }

  async function addBaseline(payload: Record<string, unknown>) {
    await mutate("baseline", () => createPlanningBaseline(token, selectedProjectId, payload), { action: "baseline_created" });
  }

  async function addResource(payload: Record<string, unknown>) {
    await mutate("resource", () => createPlanningResource(token, selectedProjectId, payload), { action: "resource_created" });
  }

  async function assignResource(payload: Record<string, unknown>) {
    await mutate("resource", () => assignPlanningResource(token, payload), { action: "resource_assigned" });
  }

  async function mutate(action: string, run: () => Promise<unknown>, okStatus: Record<string, unknown>) {
    if (!selectedProjectId) return;
    setBusy(action);
    try {
      await run();
      await reloadSchedule(selectedProjectId);
      setStatus({ status: "validated", ...okStatus });
    } catch (error) {
      setStatus(error);
      await reloadSchedule(selectedProjectId).catch(() => undefined);
    } finally {
      setBusy("");
    }
  }
}

function PlanningModuleState({ module, busyAction, onActivate }: Pick<PlanningWorkspaceProps, "module" | "busyAction" | "onActivate">) {
  const action = module?.status === "disabled" ? "Enable" : "Install";
  return (
    <section className="planning-workspace" aria-label="Planning">
      <Pane title="Planning" description="Module state" wide>
        <div className="module-row">
          <div className="module-main">
            <div className="module-title-line">
              <h2 className="module-name">{PLANNING_MODULE_ID}</h2>
              <StatusPill label={module?.status || "available"} tone="info" />
            </div>
            <p className="module-meta">capability_module - {module?.version || "not loaded"}</p>
          </div>
          <div className="module-actions">
            <CommandButton icon={Plus} onClick={onActivate} loading={busyAction.startsWith(PLANNING_MODULE_ID)}>
              {action}
            </CommandButton>
          </div>
        </div>
      </Pane>
    </section>
  );
}

function taskPayload(title: string, start: string, end: string, progress: number, sortOrder: number, taskType = "task", parentTaskId?: string) {
  return { title, start, end, progress, sort_order: sortOrder, task_type: taskType, parent_task_id: parentTaskId };
}

function resultId(value: unknown) {
  return String((value as { id?: string; result?: { id?: string } }).id || (value as { result?: { id?: string } }).result?.id || "");
}
