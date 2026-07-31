import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { listPlanningProjects, transitionPlanningProject } from "./planningApi";
import type { PlanningStrongEtag } from "./planningApi";
import type { PlanningProjectCreateRequest } from "./planningContracts";
import { createPlanningDemoSchedule } from "./planningDemoSchedule";
import { createPlanningWorkspaceProject } from "./planningProjectCreation";
import { handlePlanningProjectTransitionFailure } from "./planningProjectTransitionFailure";
import { planningWorkspaceErrorMessage, planningWorkspaceErrorStatus } from "./planningWorkspaceStatus";
import type { PlanningProject, PlanningSchedule } from "./types";

type ProjectOperationProps = {
  token: string;
  operational: boolean;
  selectedProjectId: string;
  schedule: PlanningSchedule | null;
  setProjects: Dispatch<SetStateAction<PlanningProject[]>>;
  setSchedule: (schedule: PlanningSchedule | null) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (taskId: string) => void;
  setStatus: Dispatch<SetStateAction<unknown>>;
  setCurrentEtag: (etag: PlanningStrongEtag | null) => void;
  getCurrentEtag: () => PlanningStrongEtag | null;
  reloadSchedule: (projectId: string, current?: () => boolean) => Promise<PlanningSchedule>;
  clearHistory: () => void;
  clearRecovery: () => void;
  startOperation: (action: string) => number | false;
  finishOperation: (ticket: number) => void;
  invalidateOperation: () => void;
  isOperationCurrent: (ticket: number) => boolean;
};

export function usePlanningProjectOperations(props: ProjectOperationProps) {
  const {
    clearHistory,
    clearRecovery,
    finishOperation,
    invalidateOperation,
    isOperationCurrent,
    operational,
    reloadSchedule,
    setCurrentEtag,
    setProjects,
    setSchedule,
    setSelectedProjectId,
    setStatus,
    startOperation,
    token,
  } = props;
  const selectedProjectIdRef = useRef(props.selectedProjectId);
  useEffect(() => {
    selectedProjectIdRef.current = props.selectedProjectId;
  }, [props.selectedProjectId]);

  useLayoutEffect(() => {
    invalidateOperation();
    clearHistory();
    clearRecovery();
  }, [clearHistory, clearRecovery, invalidateOperation, operational, token]);

  const selectProject = useCallback((projectId: string) => {
    selectedProjectIdRef.current = projectId;
    setSelectedProjectId(projectId);
  }, [setSelectedProjectId]);

  const refresh = useCallback(async () => {
    if (!token || !operational) return;
    const ticket = startOperation("refresh");
    if (!ticket) return;
    try {
      const rows = await listPlanningProjects(token);
      if (!isOperationCurrent(ticket)) return;
      setProjects(rows);
      const selected = selectedProjectIdRef.current;
      const projectId = rows.some((project) => project.id === selected)
        ? selected
        : rows.find((project) => project.status !== "archived")?.id || rows[0]?.id || "";
      if (projectId) {
        await reloadSchedule(projectId, () => isOperationCurrent(ticket));
        if (!isOperationCurrent(ticket)) return;
        selectProject(projectId);
      } else {
        selectProject("");
        setSchedule(null);
        setCurrentEtag(null);
      }
      setStatus({ status: "ready", projects: rows.length });
    } catch (error) {
      if (isOperationCurrent(ticket)) setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      finishOperation(ticket);
    }
  }, [
    finishOperation, isOperationCurrent, operational, reloadSchedule, selectProject,
    setCurrentEtag, setProjects, setSchedule, setStatus, startOperation, token,
  ]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createDemoSchedule() {
    const ticket = props.startOperation("demo");
    if (!ticket) return;
    try {
      const created = await createPlanningDemoSchedule(props.token);
      if (!props.isOperationCurrent(ticket)) return;
      const rows = await listPlanningProjects(props.token);
      if (!props.isOperationCurrent(ticket)) return;
      await props.reloadSchedule(created.projectId, () => props.isOperationCurrent(ticket));
      if (!props.isOperationCurrent(ticket)) return;
      props.setProjects(rows);
      selectProject(created.projectId);
      props.clearHistory();
      props.clearRecovery();
      props.setStatus({ status: "created", project_id: created.projectId });
    } catch (error) {
      if (props.isOperationCurrent(ticket)) props.setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      props.finishOperation(ticket);
    }
  }

  async function createProject(payload: PlanningProjectCreateRequest) {
    const ticket = props.startOperation("project-create");
    if (!ticket) throw new Error("Planning is busy. Wait for the current operation to finish.");
    try {
      const result = await createPlanningWorkspaceProject({
        token: props.token,
        payload,
        current: () => props.isOperationCurrent(ticket),
        onCreated: commitCreatedProject,
        onProjects: props.setProjects,
        reloadSchedule: (projectId) => props.reloadSchedule(projectId, () => props.isOperationCurrent(ticket)),
      });
      if (!props.isOperationCurrent(ticket)) return result.project;
      props.setStatus(result.reloadError
        ? { status: "created_reload_failed", project_id: result.project.id, project_name: result.project.name, reload_error: planningWorkspaceErrorMessage(result.reloadError) }
        : { status: "created", project_id: result.project.id, project_name: result.project.name });
      return result.project;
    } finally {
      props.finishOperation(ticket);
    }
  }

  async function changeProject(projectId: string) {
    const ticket = props.startOperation("project-change");
    if (!ticket) return;
    try {
      await props.reloadSchedule(projectId, () => props.isOperationCurrent(ticket));
      if (!props.isOperationCurrent(ticket)) return;
      selectProject(projectId);
      props.clearHistory();
      props.clearRecovery();
    } catch (error) {
      if (props.isOperationCurrent(ticket)) props.setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      props.finishOperation(ticket);
    }
  }

  async function deleteProject(reason: string) {
    return transitionProject("archived", reason);
  }

  async function restoreProject(reason: string) {
    await transitionProject("active", reason);
  }

  async function transitionProject(targetStatus: "active" | "archived", reason: string) {
    const projectId = selectedProjectIdRef.current;
    const project = props.schedule?.project;
    const etag = props.getCurrentEtag();
    const trimmedReason = reason.trim();
    const action = targetStatus === "archived" ? "project-delete" : "project-restore";
    const label = targetStatus === "archived" ? "Delete project" : "Restore project";
    if (!projectId || project?.id !== projectId || !etag) throw new Error("Reload the project before changing its lifecycle.");
    if (!trimmedReason) throw new Error(`${label} requires a reason.`);
    const ticket = props.startOperation(action);
    if (!ticket) throw new Error("Planning is busy. Wait for the current operation to finish.");

    try {
      let transition;
      try {
        transition = await transitionPlanningProject(props.token, projectId, {
          expected_revision: project.revision,
          target_status: targetStatus,
          reason: trimmedReason,
        }, { ifMatch: etag });
      } catch (error) {
        if (props.isOperationCurrent(ticket)) {
          await handlePlanningProjectTransitionFailure({
            clearHistory: props.clearHistory,
            clearRecovery: props.clearRecovery,
            error,
            isCurrent: () => props.isOperationCurrent(ticket),
            label,
            projectId,
            reloadSchedule: props.reloadSchedule,
            setStatus: props.setStatus,
          });
        }
        throw error;
      }
      if (!props.isOperationCurrent(ticket)) return projectId;

      const transitionedProject = { ...project, ...transition.data };
      props.setCurrentEtag(transition.etag);
      props.setSchedule(props.schedule ? { ...props.schedule, project: transitionedProject } : null);
      props.setProjects((current) => current.map((row) => row.id === projectId ? transitionedProject : row));
      props.clearHistory();
      props.clearRecovery();

      let rows: PlanningProject[];
      try {
        rows = await listPlanningProjects(props.token);
      } catch (error) {
        props.setStatus({
          status: "project_transition_reload_failed",
          action,
          project_id: projectId,
          message: planningWorkspaceErrorMessage(error),
        });
        return projectId;
      }
      if (!props.isOperationCurrent(ticket)) return projectId;
      props.setProjects(rows);

      if (targetStatus === "archived") {
        const fallback = rows.find((row) => row.id !== projectId && row.status !== "archived");
        if (!fallback) {
          selectProject("");
          props.setSelectedTaskId("");
          props.setSchedule(null);
          props.setCurrentEtag(null);
          props.setStatus({ status: "validated", action: "project_archived", project_id: projectId });
          return "";
        }
        try {
          await props.reloadSchedule(fallback.id, () => props.isOperationCurrent(ticket));
        } catch (error) {
          props.setStatus({
            status: "project_transition_reload_failed",
            action,
            project_id: projectId,
            message: planningWorkspaceErrorMessage(error),
          });
          return projectId;
        }
        if (!props.isOperationCurrent(ticket)) return projectId;
        selectProject(fallback.id);
        props.setStatus({ status: "validated", action: "project_archived", project_id: projectId, selected_project_id: fallback.id });
        return fallback.id;
      }

      try {
        await props.reloadSchedule(projectId, () => props.isOperationCurrent(ticket));
      } catch (error) {
        props.setStatus({
          status: "project_transition_reload_failed",
          action,
          project_id: projectId,
          message: planningWorkspaceErrorMessage(error),
        });
        return projectId;
      }
      if (props.isOperationCurrent(ticket)) {
        selectProject(projectId);
        props.setStatus({ status: "validated", action: "project_restored", project_id: projectId });
      }
      return projectId;
    } finally {
      props.finishOperation(ticket);
    }
  }

  function commitCreatedProject(project: PlanningProject) {
    selectProject(project.id);
    props.setProjects((current) => current.some((row) => row.id === project.id) ? current : [...current, project]);
    props.setSchedule(null);
    props.setSelectedTaskId("");
    props.setCurrentEtag(null);
    props.clearHistory();
    props.clearRecovery();
  }

  return { changeProject, createDemoSchedule, createProject, deleteProject, refresh, restoreProject };
}
