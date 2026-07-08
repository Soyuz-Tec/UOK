import { CalendarRange, FolderKanban, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { CommandButton } from "../../shared/primitives";
import { EmptyState, StatusPill } from "../../shared/data-display";
import { Pane, WorkflowHeader, WorkflowSplitView } from "../../shared/layout";
import { loadPlanningSchedule, listPlanningProjects, planningCommand, updatePlanningTask } from "./planningApi";
import { PLANNING_MODULE_ID } from "./planningModule";
import { PlanningGantt } from "./PlanningGantt";
import { PlanningTaskGrid } from "./PlanningTaskGrid";
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

  const refresh = useCallback(async () => {
    if (!token || !operational) return;
    setBusy("refresh");
    try {
      const rows = await listPlanningProjects(token);
      setProjects(rows);
      const projectId = selectedProjectId || rows[0]?.id || "";
      setSelectedProjectId(projectId);
      if (projectId) {
        const nextSchedule = await loadPlanningSchedule(token, projectId);
        setSchedule(nextSchedule);
        setSelectedTaskId((current) => current || nextSchedule.tasks[0]?.id || "");
      } else {
        setSchedule(null);
      }
      setStatus({ status: "ready", projects: rows.length });
    } catch (error) {
      setStatus(error);
    } finally {
      setBusy("");
    }
  }, [operational, selectedProjectId, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!token) return <EmptyState text="Sign in to open Planning." />;
  if (!operational) {
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

  return (
    <section className="planning-workspace" aria-label="Planning">
      <WorkflowHeader
        eyebrow="Planning"
        title="Project schedule"
        summary={schedule ? `${schedule.tasks.length} tasks, ${schedule.dependencies.length} dependencies` : "Create a sample schedule to begin."}
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
              onProjectChange={changeProject}
              onTaskSelect={setSelectedTaskId}
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
        start: "2026-08-01",
        end: "2026-08-20",
      }, "planning-project");
      const first = await planningCommand<PlanningTask>(token, "CreatePlanningTask", {
        project_id: project.result.id,
        title: "Define schedule scope",
        start: "2026-08-01",
        end: "2026-08-03",
        progress: 40,
        sort_order: 1,
      }, "planning-task-a");
      const second = await planningCommand<PlanningTask>(token, "CreatePlanningTask", {
        project_id: project.result.id,
        title: "Build integrated Gantt",
        start: "2026-08-04",
        end: "2026-08-10",
        sort_order: 2,
      }, "planning-task-b");
      await planningCommand(token, "LinkPlanningTasks", {
        project_id: project.result.id,
        predecessor_task_id: first.result.id,
        successor_task_id: second.result.id,
      }, "planning-link");
      const nextProjects = await listPlanningProjects(token);
      const nextSchedule = await loadPlanningSchedule(token, project.result.id);
      setProjects(nextProjects);
      setSelectedProjectId(project.result.id);
      setSchedule(nextSchedule);
      setSelectedTaskId(nextSchedule.tasks[0]?.id || "");
      setStatus({ status: "created", project_id: project.result.id });
    } catch (error) {
      setStatus(error);
    } finally {
      setBusy("");
    }
  }

  async function changeProject(projectId: string) {
    setSelectedProjectId(projectId);
    const nextSchedule = await loadPlanningSchedule(token, projectId);
    setSchedule(nextSchedule);
    setSelectedTaskId(nextSchedule.tasks[0]?.id || "");
  }

  async function rescheduleTask(taskId: string, start: string, end: string) {
    setBusy("reschedule");
    try {
      await updatePlanningTask(token, taskId, { start, end });
      if (selectedProjectId) setSchedule(await loadPlanningSchedule(token, selectedProjectId));
      setStatus({ status: "validated", taskId, start, end });
    } catch (error) {
      setStatus(error);
      await refresh();
    } finally {
      setBusy("");
    }
  }
}

function PlanningInspector({ projects, schedule, selectedTask, selectedTaskId, status, onProjectChange, onTaskSelect }: {
  projects: PlanningProject[];
  schedule: PlanningSchedule;
  selectedTask: PlanningTask | null;
  selectedTaskId: string;
  status: unknown;
  onProjectChange: (projectId: string) => void;
  onTaskSelect: (taskId: string) => void;
}) {
  return (
    <Pane title="Inspector" description={schedule.project.name}>
      <label className="field">
        <span>Project</span>
        <select value={schedule.project.id} onChange={(event) => onProjectChange(event.target.value)}>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
      </label>
      <PlanningTaskGrid tasks={schedule.tasks} selectedTaskId={selectedTaskId} onSelect={onTaskSelect} />
      {selectedTask && (
        <div className="planning-selected-task">
          <CalendarRange size={18} aria-hidden="true" />
          <div>
            <strong>{selectedTask.title}</strong>
            <span>{selectedTask.start} to {selectedTask.end}</span>
          </div>
        </div>
      )}
      <pre className="planning-status" aria-label="Planning validation status">{JSON.stringify({ validation: schedule.validation, status }, null, 2)}</pre>
    </Pane>
  );
}
