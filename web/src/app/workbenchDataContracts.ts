import type {
  Dashboard,
  ModuleStatus,
  QualityReport,
} from "../shared/types";

export type WorkbenchSession = {
  token: string;
  generation: number;
  onUnauthorized: () => number | null;
};

export type StampedValue<T> = {
  generation: number;
  value: T;
};

export type DashboardBundle = {
  dashboard: Dashboard;
  modules: Record<string, ModuleStatus>;
  evidence: QualityReport;
  alignment: QualityReport;
};

export type WorkbenchRequest = {
  generation: number;
  signal: AbortSignal;
  isCurrent: () => boolean;
  runIfCurrent: <Result>(effect: () => Result) => Result | undefined;
  onUnauthorized: () => number | null | undefined;
  release: () => void;
};

export function workbenchRequestHeaders(token: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
