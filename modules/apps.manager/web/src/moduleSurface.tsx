import { Store } from "lucide-react";

import type { ModuleSurface } from "@uok/features/modules/moduleSurfaceContract";

import { AppsManagerPanel } from "./AppsManagerPanel";
import "./styles/index.css";

export const appsManagerModuleSurface: ModuleSurface = {
  id: "apps",
  label: "Apps Manager",
  icon: Store,
  moduleName: "apps.manager",
  order: 20,
  render: (workbench) => (
    <AppsManagerPanel
      modules={workbench.moduleRows}
      busyAction={workbench.busyAction}
      onAction={workbench.moduleAction}
    />
  )
};

export default appsManagerModuleSurface;
