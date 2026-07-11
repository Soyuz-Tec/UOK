import { CalendarRange } from "lucide-react";

import type { ModuleSurface } from "@uok/features/modules/moduleSurfaceContract";
import { PLANNING_MODULE_ID, PLANNING_SECTION_ID } from "./planningModule";
import { PlanningWorkspace } from "./PlanningWorkspace";
import "./styles/index.css";

export const planningModuleSurface: ModuleSurface = {
  id: PLANNING_SECTION_ID,
  label: "Planning",
  icon: CalendarRange,
  moduleName: PLANNING_MODULE_ID,
  order: 60,
  render: (workbench) => {
    const planningModule = workbench.moduleRows.find((row) => row.name === PLANNING_MODULE_ID);
    return (
      <PlanningWorkspace
        token={workbench.token}
        appearance={workbench.appearance}
        module={planningModule}
        moduleRows={workbench.moduleRows}
        busyAction={workbench.busyAction}
        onActivate={(moduleName = PLANNING_MODULE_ID, action) =>
          workbench.moduleAction(moduleName, action || (planningModule?.status === "disabled" ? "enable" : "install"))
        }
      />
    );
  },
};

export default planningModuleSurface;
