import type { ReactNode } from "react";

import type { Workbench } from "@uok/app/useWorkbench";
import type { Option } from "@uok/shared/options";

// The shell remains the single state/composition owner in this migration slice.
// Module-specific rendering and feature code live behind this compile-time contract.
export type ModuleSurfaceHostContext = Workbench;

export type ModuleSurface = Option<string> & {
  moduleName: string;
  order?: number;
  render: (context: ModuleSurfaceHostContext) => ReactNode;
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
