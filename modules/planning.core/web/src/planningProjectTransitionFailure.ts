import { isPlanningPreconditionError } from "./planningApi";
import { planningWorkspaceErrorStatus } from "./planningWorkspaceStatus";

export async function handlePlanningProjectTransitionFailure({
  clearHistory,
  clearRecovery,
  error,
  isCurrent,
  label,
  projectId,
  reloadSchedule,
  setStatus,
}: {
  clearHistory: () => void;
  clearRecovery: () => void;
  error: unknown;
  isCurrent: () => boolean;
  label: string;
  projectId: string;
  reloadSchedule: (
    projectId: string,
    current?: () => boolean,
  ) => Promise<unknown>;
  setStatus: (status: unknown) => void;
}) {
  if (!isPlanningPreconditionError(error)) {
    setStatus(planningWorkspaceErrorStatus(error));
    return;
  }
  clearHistory();
  clearRecovery();
  let reloaded: boolean;
  try {
    await reloadSchedule(projectId, isCurrent);
    reloaded = isCurrent();
  } catch {
    reloaded = false;
  }
  setStatus({
    status: "error",
    http_status: error.status,
    ...error.detail,
    repair: reloaded
      ? `The latest schedule is loaded. Review it, then confirm ${label} again.`
      : `Reload the latest schedule before confirming ${label} again.`,
  });
}
