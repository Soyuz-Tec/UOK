import { lazy } from "react";
import { Store } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";

import "./styles/index.css";

const AppsManagerPanel = lazy(() => import("./AppsManagerPanel").then((module) => ({ default: module.AppsManagerPanel })));

export const appsManagerModuleSurface: ModuleSurface = {
  id: "apps",
  label: "Apps Manager",
  icon: Store,
  moduleName: "apps.manager",
  order: 20,
  render: (host) => (
    <AppsManagerPanel
      modules={[...host.moduleRows]}
      busyAction={host.busyAction}
      onAction={host.moduleAction}
    />
  )
};

export default appsManagerModuleSurface;
