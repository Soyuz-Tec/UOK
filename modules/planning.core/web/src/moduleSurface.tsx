import { CalendarRange } from "lucide-react";

import type { ModuleSurface } from "@uok/contracts/moduleSurface";
import { PLANNING_MODULE_ID, PLANNING_SECTION_ID } from "./planningModule";
import { PlanningWorkspace } from "./PlanningWorkspace";
import "./styles/index.css";

export const planningModuleSurface: ModuleSurface = {
  id: PLANNING_SECTION_ID,
  label: "Planning",
  icon: CalendarRange,
  moduleName: PLANNING_MODULE_ID,
  order: 60,
  render: (host) => {
    const planningModule = host.moduleRows.find((row) => row.name === PLANNING_MODULE_ID);
    return (
      <PlanningWorkspace
        token={host.session.token}
        appearance={host.appearance}
        module={planningModule}
        moduleRows={[...host.moduleRows]}
        busyAction={host.busyAction}
        onActivate={(moduleName = PLANNING_MODULE_ID, action) =>
          void host.moduleAction(moduleName, action || (planningModule?.status === "disabled" ? "enable" : "install"))
        }
      />
    );
  },
};

export default planningModuleSurface;
