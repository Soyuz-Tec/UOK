import type { ElementType, ReactNode } from "react";

export type HostAppearance = "system" | "light" | "dark";

export type HostModuleAction =
  | "install"
  | "uninstall"
  | "disable"
  | "enable"
  | "upgrade"
  | "reconcile";

export type HostModuleStatus = {
  name: string;
  status: string;
  recorded_status: string | null;
  reconciliation_required: boolean;
  maturity: "planned" | "source_present" | "unit_tested" | "integration_tested" | "runtime_proven";
  version: string;
  kind: string;
  installable: boolean;
  uninstallable: boolean;
  updatable: boolean;
  maintainable: boolean;
  required: boolean;
  lifecycle: string[];
  lifecycle_state_declared: boolean;
  dependencies: string[];
  dependents: string[];
};

export type ModuleSurfaceSession = {
  token: string;
  generation: number;
  onUnauthorized: () => void;
};

export type ModuleSurfaceHostContext = {
  session: ModuleSurfaceSession;
  currentUserRole: string;
  appearance: HostAppearance;
  moduleRows: readonly HostModuleStatus[];
  busyAction: string;
  moduleAction: (moduleName: string, action: HostModuleAction) => Promise<void>;
  refreshHost: () => Promise<void>;
  moduleRefreshRevision: number;
};

export type ModuleSurfaceRenderContext = ModuleSurfaceHostContext & {
  surfaceActive: boolean;
};

export type ModuleSurface = {
  id: string;
  label: string;
  icon: ElementType;
  moduleName: string;
  order?: number;
  render: (context: ModuleSurfaceRenderContext) => ReactNode;
};

export type FrontendModuleManifest = {
  moduleName: string;
  sectionId: string;
  webEntry: string;
  dependencies: readonly string[];
};

export type GeneratedModuleSurfaceRegistration = {
  manifest: FrontendModuleManifest;
  surface: ModuleSurface;
};
