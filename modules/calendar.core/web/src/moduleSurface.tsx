import { CalendarDays } from "lucide-react";

import type { ModuleSurface } from "@uok/features/modules/moduleSurfaceContract";

import { CalendarWorkspace } from "./CalendarWorkspace";
import { CALENDAR_MODULE_ID, CALENDAR_SECTION_ID } from "./calendarModule";
import "./styles/index.css";

export const calendarModuleSurface: ModuleSurface = {
  id: CALENDAR_SECTION_ID,
  label: "Calendar",
  icon: CalendarDays,
  moduleName: CALENDAR_MODULE_ID,
  order: 40,
  render: (workbench) => (
    <CalendarWorkspace
      token={workbench.token}
      moduleRows={workbench.moduleRows}
      busyAction={workbench.busyAction}
      onInstall={() => workbench.moduleAction(CALENDAR_MODULE_ID, "install")}
    />
  )
};

export default calendarModuleSurface;
