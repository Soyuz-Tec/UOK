import type {
  PlanningMutationResponse,
  PlanningPreconditionDetail,
  PlanningStrongEtag,
} from "./planningApi";
import type { PlanningHistoryEntry } from "./planningHistory";
import type { PlanningSchedule } from "./types";

export type PlanningStaleRecovery = {
  detail: PlanningPreconditionDetail;
  label: string;
  reloadFailed: boolean;
};

export type PlanningMutationIntent = {
  action: string;
  label: string;
  okStatus: Record<string, unknown>;
  run: (etag: PlanningStrongEtag) => Promise<PlanningMutationResponse<unknown>>;
  history: (before: PlanningSchedule, after: PlanningSchedule, label: string) => PlanningHistoryEntry | null;
  successStatus?: (responseData: unknown) => Record<string, unknown>;
};
