import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { listPlanningProjects } from "./planningApi";
import type { PlanningStrongEtag } from "./planningApi";
import type { PlanningProjectCreateRequest } from "./planningContracts";
import { createPlanningDemoSchedule } from "./planningDemoSchedule";
import { createPlanningWorkspaceProject } from "./planningProjectCreation";
import { planningWorkspaceErrorMessage, planningWorkspaceErrorStatus } from "./planningWorkspaceStatus";
import type { PlanningProject, PlanningSchedule } from "./types";

type ProjectOperationProps = {
  token: string;
  operational: boolean;
  selectedProjectId: string;
  setProjects: Dispatch<SetStateAction<PlanningProject[]>>;
  setSchedule: (schedule: PlanningSchedule | null) => void;
  setSelectedProjectId: (projectId: string) => void;
  setSelectedTaskId: (taskId: string) => void;
  setStatus: Dispatch<SetStateAction<unknown>>;
  setCurrentEtag: (etag: PlanningStrongEtag | null) => void;
  reloadSchedule: (projectId: string, current?: () => boolean) => Promise<PlanningSchedule>;
  clearHistory: () => void;
  clearRecovery: () => void;
  startOperation: (action: string) => number | false;
  finishOperation: (ticket: number) => void;
  invalidateOperation: () => void;
  isOperationCurrent: (ticket: number) => boolean;
};

export function usePlanningProjectOperations(props: ProjectOperationProps) {
  const selectedProjectIdRef = useRef(props.selectedProjectId);
  useEffect(() => {
    selectedProjectIdRef.current = props.selectedProjectId;
  }, [props.selectedProjectId]);

  useLayoutEffect(() => {
    props.invalidateOperation();
    props.clearHistory();
    props.clearRecovery();
  }, [props.clearHistory, props.clearRecovery, props.invalidateOperation, props.operational, props.token]);

  const selectProject = useCallback((projectId: string) => {
    selectedProjectIdRef.current = projectId;
    props.setSelectedProjectId(projectId);
  }, [props.setSelectedProjectId]);

  const refresh = useCallback(async () => {
    if (!props.token || !props.operational) return;
    const ticket = props.startOperation("refresh");
    if (!ticket) return;
    try {
      const rows = await listPlanningProjects(props.token);
      if (!props.isOperationCurrent(ticket)) return;
      props.setProjects(rows);
      const selected = selectedProjectIdRef.current;
      const projectId = rows.some((project) => project.id === selected) ? selected : rows[0]?.id || "";
      if (projectId) {
        await props.reloadSchedule(projectId, () => props.isOperationCurrent(ticket));
        if (!props.isOperationCurrent(ticket)) return;
        selectProject(projectId);
      } else {
        selectProject("");
        props.setSchedule(null);
        props.setCurrentEtag(null);
      }
      props.setStatus({ status: "ready", projects: rows.length });
    } catch (error) {
      if (props.isOperationCurrent(ticket)) props.setStatus(planningWorkspaceErrorStatus(error));
    } finally {
      props.finishOperation(ticket);
    }
  }, [
    props.finishOperation, props.isOperationCurrent, props.operational, props.reloadSchedule,
    props.setCurrentEtag, props.setProjects, props.setSchedule, props.setStatus,
    props.startOperation, props.token, selectProject,
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

  function commitCreatedProject(project: PlanningProject) {
    selectProject(project.id);
    props.setProjects((current) => current.some((row) => row.id === project.id) ? current : [...current, project]);
    props.setSchedule(null);
    props.setSelectedTaskId("");
    props.setCurrentEtag(null);
    props.clearHistory();
    props.clearRecovery();
  }

  return { changeProject, createDemoSchedule, createProject, refresh };
}
